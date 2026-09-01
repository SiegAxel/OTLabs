# Despliegue en DirectAdmin

1. Crea la base de datos MariaDB y un usuario desde DirectAdmin. Anota el nombre completo que entrega el panel, normalmente con un prefijo de cuenta.
2. En Python Selector crea una aplicacion Python 3.11 o superior con el subdominio de la API.
3. Sube y extrae este paquete dentro del directorio raiz de la aplicacion, fuera de `public_html` si el panel lo permite.
4. Copia `.env.production.example` a `.env` y reemplaza todos los valores `REEMPLAZAR` y `TU_`.
5. En la terminal del entorno virtual de la aplicacion ejecuta:

   ```bash
   pip install -r requirements.txt
   ```

   Al iniciar, la aplicacion creara sus tablas y los datos base. No ejecutes las migraciones historicas de Alembic: pertenecen a la antigua base PostgreSQL.

6. Configura `passenger_wsgi.py` como archivo de inicio y `application` como punto de entrada. Reinicia la aplicacion.
7. Comprueba `https://TU_SUBDOMINIO/health` y luego `https://TU_SUBDOMINIO/docs`.

No subas un `.env` existente ni la carpeta `venv`. Si la clave de base de datos incluye `@`, `:`, `/` o `#`, codifica esos caracteres en la URL de `DATABASE_URL`.
