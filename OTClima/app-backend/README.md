# API OTLabs v1

API REST para gestión de usuarios con autenticación JWT y verificación de email.

## Requisitos

- Python 3.11+
- PostgreSQL 14+

## Instalación

1. **Clonar el proyecto:**
```bash
git clone <repo-url>
cd api-otlabs
```

2. **Crear entorno virtual:**
```bash
python -m venv venv
```

3. **Activar entorno virtual:**
```bash
# Windows (CMD)
venv\Scripts\activate

# Windows (PowerShell)
.\venv\Scripts\Activate

# Linux/Mac
source venv/bin/activate
```

4. **Instalar dependencias:**
```bash
pip install -r requirements.txt
```

4. **Configurar variables de entorno:**
```bash
cp .env.example .env
# Editar .env con tus valores
```

5. **Ejecutar migraciones (recomendado):**
```bash
alembic upgrade head
```

## Configuración (.env)

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/otlabs_db

# JWT
SECRET_KEY=tu-secret-key-segura
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (Resend)
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@tudominio.com
BASE_URL=http://localhost:8000
VERIFICATION_TOKEN_EXPIRE_HOURS=24

# Configuración
DEBUG=true
SWAGGER_USER=admin
SWAGGER_PASSWORD=admin123

# Bootstrap admin inicial (opcional)
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_EMAIL=admin@tudominio.com
INITIAL_ADMIN_PASSWORD=cambia-esta-clave
```

## Iniciar servidor

```bash
uvicorn app.main:app --reload
```

La API estará disponible en: `http://localhost:8000`

- Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Endpoints

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Registrar nuevo usuario |
| POST | `/api/v1/auth/login` | Iniciar sesión (username o email) |
| POST | `/api/v1/auth/refresh` | Actualizar access token |
| POST | `/api/v1/auth/logout` | Cerrar sesión |
| GET | `/api/v1/auth/me` | Obtener usuario actual |
| GET | `/api/v1/auth/verify-email?token=xxx` | Verificar email (enlace) |
| POST | `/api/v1/auth/verify-email` | Verificar email (código) |
| POST | `/api/v1/auth/resend-verification` | Reenviar código de verificación |

### Administración de permisos dinámicos

Los usuarios se registran con rol principal `Tecnico` por defecto. Los permisos efectivos son la unión de:

- Permisos del rol principal
- Permisos directos asignados al usuario

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/admin/users` | Listar usuarios con rol y permisos |
| PATCH | `/api/v1/admin/users/{user_id}/role` | Cambiar rol principal de usuario |
| POST | `/api/v1/admin/users/{user_id}/permissions` | Agregar permiso directo |
| DELETE | `/api/v1/admin/users/{user_id}/permissions/{permission_code}` | Quitar permiso directo |
| GET | `/api/v1/admin/roles` | Listar roles y permisos de rol |
| GET | `/api/v1/admin/permissions` | Listar catálogo de permisos |

Permisos iniciales del rol `Tecnico`:

- `auth.me.read`
- `tickets.read.assigned`
- `tickets.update.assigned`
- `workorders.read.assigned`
- `workorders.update.assigned`
- `clients.read.assigned`
- `inventory.read`
- `reports.technical.read`

### Bootstrap del primer administrador

Para evitar quedar sin acceso a endpoints de administración en un entorno nuevo, define estas variables antes del primer arranque:

- `INITIAL_ADMIN_USERNAME`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`

En startup, el sistema crea o promueve ese usuario al rol `Admin` (idempotente).

## Ejemplos de uso

### 1. Registrar usuario

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuario1",
    "email": "usuario@ejemplo.com",
    "password": "password123"
  }'
```

Respuesta:
```json
{
  "id": 1,
  "username": "usuario1",
  "email": "usuario@ejemplo.com",
  "is_active": true,
  "is_verified": false
}
```

### 2. Verificar email

Después de registrarte, recibirás un email con un enlace de verificación y un código de 6 dígitos.

**Con código:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

**O con el enlace:**
Simplemente abre el enlace del email en el navegador.

### 3. Iniciar sesión

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "usuario1", "password": "password123"}'
```

También puedes usar email en lugar de username.

Respuesta:
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

### 4. Obtener usuario actual

```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

### 5. Actualizar token (refresh)

```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "TU_REFRESH_TOKEN"}'
```

### 6. Cerrar sesión

```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "TU_REFRESH_TOKEN"}'
```

### 7. Reenviar código de verificación

```bash
curl -X POST http://localhost:8000/api/v1/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@ejemplo.com"}'
```

## Esquemas

### UserCreate (Registro)
```json
{
  "username": "string",
  "email": "user@example.com",
  "password": "string"
}
```

### LoginRequest
```json
{
  "username": "string",  // username o email
  "password": "string"
}
```

### TokenResponse
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer"
}
```

### UserResponse
```json
{
  "id": 1,
  "username": "string",
  "email": "string",
  "is_active": true,
  "is_verified": false
}
```

## Errores comunes

| Código | Descripción |
|--------|-------------|
| 400 | Username o email ya registrado |
| 401 | Credenciales incorrectas / Email no verificado / Usuario inactivo |
| 404 | Usuario no encontrado |
| 422 | Validación de datos fallida |

## Producción

Para poner en producción:

1. Cambiar `DEBUG=false` en `.env`
2. Configurar credenciales seguras para Swagger
3. Usar un dominio verificado en Resend
4. Configurar HTTPS
5. Cambiar `SECRET_KEY` a una clave segura

## Tecnologías

- FastAPI
- PostgreSQL + SQLAlchemy
- JWT (PyJWT)
- Resend (envío de emails)
- Python 3.11+
