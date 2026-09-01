from datetime import datetime, timedelta, timezone
import asyncio
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.connection import get_db
from app.db.base import Company, User, RefreshToken
from app.models.schemas import (
    LoginRequest,
    TokenResponse,
    UserResponse,
    RefreshTokenRequest,
    LogoutRequest,
    UserInDB,
    VerifyEmailRequest,
    ResendVerificationRequest,
    RegisterRequest,
    RegisterResponse,
)
from app.auth.hash_utils import hash_password, verify_password
from app.auth.jwt_utils import create_access_token, create_refresh_token, verify_token, verify_refresh_token
from app.auth.deps import get_current_user, CurrentUser
from app.config.settings import settings
from app.services.email_service import send_verification_email
from app.services.company_service import (
    INDEPENDENT_COMPANY_NAME,
    get_independent_company,
    get_worker_range_by_code,
)
from app.services.rbac_service import (
    ADMIN_ROLE_NAME,
    ensure_user_default_role,
    get_or_create_role,
    get_user_effective_permissions,
    get_user_primary_role_name,
)

router = APIRouter()


def _password_meets_policy(password: str) -> bool:
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    return True


def _generate_unique_username(db: Session, email: str) -> str:
    base = email.split("@")[0].strip().lower()
    base = re.sub(r"[^a-z0-9._-]", "", base)
    base = base or "user"

    candidate = base
    suffix = 1
    while db.query(User).filter(User.username == candidate).first() is not None:
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    existing_email = db.query(User).filter(User.email == request.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    if not request.terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Terms must be accepted",
        )

    if not _password_meets_policy(request.password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters and include uppercase, lowercase, and numbers",
        )

    account_status = "approved"
    company = None
    worker_range = None
    full_name = None
    phone = None
    city_commune = None

    if request.account_type == "independent":
        if not request.profile.full_name or not request.profile.phone or not request.profile.city_commune:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="full_name, phone, and city_commune are required for independent accounts",
            )
        full_name = request.profile.full_name.strip()
        phone = request.profile.phone.strip()
        city_commune = request.profile.city_commune.strip()
        company = get_independent_company(db)
        if company is None:
            company = Company(name=INDEPENDENT_COMPANY_NAME, is_independent=True)
            db.add(company)
            db.flush()
    else:
        if (
            not request.profile.business_name
            or not request.profile.company_tax_id
            or not request.profile.company_phone
            or not request.profile.company_email
            or not request.profile.address
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="business_name, company_tax_id, company_phone, company_email, and address are required for company accounts",
            )
        if not request.worker_range:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="worker_range is required for company accounts",
            )

        account_status = "pending_approval"
        worker_range = get_worker_range_by_code(db, request.worker_range)
        if worker_range is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid worker_range",
            )

        company = db.query(Company).filter(Company.tax_id == request.profile.company_tax_id.strip()).first()
        if company is None:
            company = db.query(Company).filter(Company.name == request.profile.business_name.strip()).first()
        if company is None:
            company = Company(
                name=request.profile.business_name.strip(),
                tax_id=request.profile.company_tax_id.strip(),
                phone=request.profile.company_phone.strip(),
                email=str(request.profile.company_email).strip().lower(),
                address=request.profile.address.strip(),
                is_independent=False,
            )
            db.add(company)
            db.flush()

    from app.services.email_service import generate_verification_token, generate_verification_code

    token = generate_verification_token()
    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRE_HOURS)

    generated_username = _generate_unique_username(db, str(request.email))

    db_user = User(
        username=generated_username,
        email=str(request.email).strip().lower(),
        hashed_password=hash_password(request.password),
        verification_token=token,
        verification_code=code,
        verification_expires_at=expires_at,
        account_type=request.account_type,
        account_status=account_status,
        terms_accepted=request.terms_accepted,
        full_name=full_name,
        phone=phone,
        city_commune=city_commune,
        company=company,
        worker_range=worker_range,
    )
    if request.account_type == "company":
        db_user.primary_role = get_or_create_role(db, ADMIN_ROLE_NAME, "Company administrator")
    ensure_user_default_role(db, db_user)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    asyncio.run(send_verification_email(db_user.email, db_user.username, token, code))

    if db_user.account_status == "pending_approval":
        message = "Solicitud enviada para revision"
    else:
        message = "Registro completado correctamente"

    return RegisterResponse(
        status=db_user.account_status,
        message=message,
        user_id=db_user.id,
    )


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == credentials.username) | (User.email == credentials.username)
    ).first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.account_status == "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company account is pending administrator approval",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.account_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company account was rejected. Contact support.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified. Please verify your email first.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token_data = {"sub": user.username, "user_id": user.id, "version": user.token_version}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    expires_at = datetime.utcnow() + timedelta(days=7)
    db_refresh = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=expires_at,
    )
    db.add(db_refresh)
    db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = verify_refresh_token(request.refresh_token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    stored_token = db.query(RefreshToken).filter(
        RefreshToken.token == request.refresh_token,
        RefreshToken.is_revoked == False,
    ).first()
    
    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked or not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    stored_token.is_revoked = True
    db.commit()
    
    user_id = payload.get("user_id")
    username = payload.get("sub")
    version = payload.get("version")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token_data = {"sub": username, "user_id": user_id, "version": user.token_version}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    expires_at = datetime.utcnow() + timedelta(days=7)
    db_refresh = RefreshToken(
        user_id=user_id,
        token=refresh_token,
        expires_at=expires_at,
    )
    db.add(db_refresh)
    db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/logout")
def logout(request: LogoutRequest, current_user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current_user.user_id).first()
    if user:
        user.token_version += 1
        db.commit()
    
    if request.refresh_token:
        stored_token = db.query(RefreshToken).filter(
            RefreshToken.token == request.refresh_token,
            RefreshToken.is_revoked == False,
        ).first()
        if stored_token:
            stored_token.is_revoked = True
            db.commit()
    
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current_user.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        is_verified=user.is_verified,
        account_type=user.account_type,
        account_status=user.account_status,
        company_id=user.company_id,
        company=user.company.name if user.company is not None else None,
        worker_range=user.worker_range.code if user.worker_range is not None else None,
        primary_role=get_user_primary_role_name(user),
        permissions=get_user_effective_permissions(user),
    )


@router.get("/verify-email")
def verify_email_get(token: str | None = None, db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token is required",
        )
    
    user = db.query(User).filter(User.verification_token == token).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token",
        )
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified",
        )
    
    if user.verification_expires_at and user.verification_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired",
        )
    
    user.is_verified = True
    user.verification_token = None
    user.verification_code = None
    user.verification_expires_at = None
    db.commit()
    
    return {"message": "Email verified successfully"}


@router.post("/verify-email")
def verify_email(request: VerifyEmailRequest, db: Session = Depends(get_db)):
    if not request.token and not request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token or code is required",
        )
    
    user = None
    if request.token:
        user = db.query(User).filter(User.verification_token == request.token).first()
    elif request.code:
        user = db.query(User).filter(
            User.verification_code == request.code,
            User.is_verified == False
        ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token or code",
        )
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified",
        )
    
    if user.verification_expires_at and user.verification_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token or code has expired",
        )
    
    user.is_verified = True
    user.verification_token = None
    user.verification_code = None
    user.verification_expires_at = None
    db.commit()
    
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
def resend_verification(request: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        return {"message": "If the email exists, a verification email will be sent"}
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified",
        )
    
    from app.services.email_service import generate_verification_token, generate_verification_code
    
    token = generate_verification_token()
    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRE_HOURS)
    
    user.verification_token = token
    user.verification_code = code
    user.verification_expires_at = expires_at
    db.commit()
    
    asyncio.run(send_verification_email(user.email, user.username, token, code))
    
    return {"message": "Verification email sent successfully"}
