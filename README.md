# WealthHub

Una aplicación web de gestión y visualización de activos financieros (Fondos, Criptomonedas, Acciones, Cash) con capacidades de sincronización automática a Google Apps Script (GAS) y Docker.

## Características

- 📊 **Gestión Multiactivos**: Soporte para criptomonedas, fondos de inversión, acciones y otros.
- ⚙️ **Cálculo de Proyecciones**: Interés compuesto y métricas financieras (`Decimal` backend integration para precisión extrema).
- ☁️ **Sincronización Cloud**: Respaldo automático utilizando Google Apps Script (GAS).
- 🐳 **Docker & Umbrel**: Listo para despliegues auto-alojados.

## Stack Tecnológico

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Recharts.
- **Backend:** Python 3.12, FastAPI, Pydantic (Validación tipada con soporte Decimal).
- **Herramientas de Sincronización:** Google Apps Script (GAS).

## Arquitectura

- `src/`: Aplicación Frontend React.
    - `src/components/`: Componentes UI reutilizables (Card, Button, Modal, etc).
    - `src/context/`: Gestión de estado de la aplicación.
    - `src/utils/`: Funciones de formateo (DRY formatters).
- `backend/`: API Backend en FastAPI.
    - `models.py`: Modelos Pydantic y definiciones de base de datos SQLModel.
    - `database.py`: Configuración de base de datos SQLite y dependencias de sesión.
    - `routes/`: Endpoints modulares de la API agrupados por dominio administrativo.
    - `services/`: Lógica de negocio (price fetchers, scrappers, histórico).
    - `main.py`: Punto de entrada unificado para FastAPI.

## Instalación y Desarrollo

### Prerrequisitos
- Node.js o Bun (para el Frontend).
- Python 3.12 (para el Backend).
- URL de Google Apps Script configurado.

### Backend

\`\`\`bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configurar GAS_URL
uvicorn main:app --reload
\`\`\`

### Frontend

\`\`\`bash
npm install # o bun install
npm run dev # o bun run dev
\`\`\`

## Guía de Despliegue con Docker

Ejecuta los siguientes comandos para levantar tanto el frontend como el backend:

\`\`\`bash
docker compose up -d --build
\`\`\`

Esto expondrá la aplicación Frontend en el puerto definido y el Backend localmente para que la app se conecte.

Para una guía más detallada de validaciones y de arquitectura extendida, revisa la configuración en el archivo \`docker-compose.yml\`.
