import secrets
import string
import httpx
from app.config.settings import settings


def generate_verification_code(length: int = 6) -> str:
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def generate_verification_link(token: str) -> str:
    return f"{settings.BASE_URL}/api/v1/auth/verify-email?token={token}"


async def send_verification_email(email: str, username: str, token: str, code: str | None = None) -> dict:
    verification_link = generate_verification_link(token)
    if code is None:
        code = generate_verification_code()
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px;">
            <h1 style="color: white; margin: 0;">Verifica tu correo electrónico</h1>
        </div>
        
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px;">Hola <strong>{username}</strong>,</p>
            
            <p style="color: #333; font-size: 14px;">Gracias por registrarte. Por favor verifica tu correo electrónico haciendo clic en el botón de abajo:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verification_link}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Verificar correo electrónico
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">O usa el siguiente código de verificación:</p>
            
            <div style="background: #fff; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; color: #333; border: 2px dashed #667eea;">
                {code}
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
                Este código expira en {settings.VERIFICATION_TOKEN_EXPIRE_HOURS} horas.<br>
                Si no solicitaste este correo, por favor ignóralo.
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© 2026 OTLabs. Todos los derechos reservados.</p>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Hola {username},
    
    Gracias por registrarte. Por favor verifica tu correo electrónico usando el siguiente código:
    
    Código de verificación: {code}
    
    O haz clic en el siguiente enlace:
    {verification_link}
    
    Este código expira en {settings.VERIFICATION_TOKEN_EXPIRE_HOURS} horas.
    """
    
    if not settings.RESEND_API_KEY:
        print("=" * 50)
        print(f"EMAIL (console logging):")
        print(f"To: {email}")
        print(f"Subject: Verifica tu correo electrónico")
        print(f"Link: {verification_link}")
        print(f"Code: {code}")
        print("=" * 50)
        return {"id": "console", "status": "sent"}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.EMAIL_FROM,
                    "to": [email],
                    "subject": "Verifica tu correo electrónico - OTLabs",
                    "html": html_content,
                    "text": text_content,
                },
                timeout=30.0,
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"Email sent successfully to {email}: {result}")
                return {"id": result.get("id", "unknown"), "status": "sent"}
            else:
                error = response.text
                print(f"Failed to send email: {error}")
                return {"error": error, "status": "failed"}
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return {"error": str(e), "status": "failed"}