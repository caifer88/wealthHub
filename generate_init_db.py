import json

def format_sql_value(val):
    """
    Formatea de manera segura los valores de Python para que sean válidos en SQL.
    Maneja nulos, booleanos, números y escapa las comillas simples en los strings.
    """
    if val is None or val == "":
        return "NULL"
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (int, float)):
        return str(val)
    # Escapar comillas simples duplicándolas (estándar SQL)
    escaped_str = str(val).replace("'", "''")
    return f"'{escaped_str}'"

def generate_init_sql(input_filename='data.json', output_filename='init.sql'):
    try:
        # Leer el archivo JSON original
        with open(input_filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        print(f"⏳ Leyendo datos de {input_filename}...")

        # Abrir el archivo SQL de salida para escribir
        with open(output_filename, 'w', encoding='utf-8') as out:
            out.write("BEGIN;\n\n")

            # --- 1. CREACIÓN DE TABLAS ---
            out.write("-- 1. CREACIÓN DE ESTRUCTURA\n")
            out.write("""
CREATE TABLE IF NOT EXISTS Asset (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    is_archived BOOLEAN DEFAULT false,
    risk_level VARCHAR(50),
    isin VARCHAR(50),
    ticker VARCHAR(50),
    description TEXT
);

CREATE TABLE IF NOT EXISTS Asset_History (
    id VARCHAR(100) PRIMARY KEY,
    asset_id VARCHAR(50) REFERENCES Asset(id),
    snapshot_date DATE NOT NULL,
    nav NUMERIC(15, 4),
    contribution NUMERIC(15, 4),
    participations NUMERIC(18, 8),
    liquid_nav_value NUMERIC(15, 4),
    mean_cost NUMERIC(15, 4)
);

CREATE TABLE IF NOT EXISTS Transaction (
    id VARCHAR(100) PRIMARY KEY,
    asset_id VARCHAR(50) REFERENCES Asset(id),
    transaction_date DATE NOT NULL,
    type VARCHAR(20),
    ticker VARCHAR(50),
    quantity NUMERIC(18, 8),
    price_per_unit NUMERIC(18, 8),
    fees NUMERIC(10, 4),
    total_amount NUMERIC(15, 4)
);
\n""")

            # --- 2. MIGRAR ACTIVOS ---
            out.write("-- 2. INSERCIÓN DE ACTIVOS\n")
            assets = data.get('assets', [])
            for a in assets:
                vals = [
                    a.get('id'), a.get('name'), a.get('category'), a.get('color'),
                    a.get('archived', False), a.get('riskLevel'), a.get('isin'),
                    a.get('ticker'), a.get('description', '')
                ]
                val_str = ", ".join(map(format_sql_value, vals))
                out.write(f"INSERT INTO Asset (id, name, category, color, is_archived, risk_level, isin, ticker, description) VALUES ({val_str}) ON CONFLICT (id) DO NOTHING;\n")

            # --- 3. MIGRAR HISTORIAL ---
            out.write("\n-- 3. INSERCIÓN DE HISTORIAL MENSUAL\n")
            history = data.get('history', [])
            for h in history:
                month_str = h.get('month', '')
                # Convertir '2020-01' a '2020-01-01'
                snapshot_date = f"{month_str}-01" if len(month_str) == 7 else month_str
                
                vals = [
                    h.get('id'), h.get('assetId'), snapshot_date, h.get('nav', 0),
                    h.get('contribution', 0), h.get('participations'),
                    h.get('liquidNavValue'), h.get('meanCost')
                ]
                val_str = ", ".join(map(format_sql_value, vals))
                out.write(f"INSERT INTO Asset_History (id, asset_id, snapshot_date, nav, contribution, participations, liquid_nav_value, mean_cost) VALUES ({val_str}) ON CONFLICT (id) DO NOTHING;\n")

            # --- 4. MIGRAR TRANSACCIONES UNIFICADAS ---
            out.write("\n-- 4. INSERCIÓN DE TRANSACCIONES\n")
            
            # 4.a Criptomonedas
            btc_txs = data.get('bitcoinTransactions', [])
            for tx in btc_txs:
                vals = [
                    tx.get('id'), 'a4', tx.get('date'), str(tx.get('type', '')).upper(),
                    'BTC', tx.get('amountBTC'), tx.get('meanPrice'), 0, tx.get('totalCost')
                ]
                val_str = ", ".join(map(format_sql_value, vals))
                out.write(f"INSERT INTO Transaction (id, asset_id, transaction_date, type, ticker, quantity, price_per_unit, fees, total_amount) VALUES ({val_str}) ON CONFLICT (id) DO NOTHING;\n")

            # 4.b Acciones
            stock_txs = data.get('stockTransactions', [])
            for tx in stock_txs:
                vals = [
                    tx.get('id'), 'a9', tx.get('date'), str(tx.get('type', '')).upper(),
                    tx.get('ticker'), tx.get('shares'), tx.get('pricePerShare'),
                    tx.get('fees', 0), tx.get('totalAmount')
                ]
                val_str = ", ".join(map(format_sql_value, vals))
                out.write(f"INSERT INTO Transaction (id, asset_id, transaction_date, type, ticker, quantity, price_per_unit, fees, total_amount) VALUES ({val_str}) ON CONFLICT (id) DO NOTHING;\n")

            out.write("\nCOMMIT;\n")
            
        print(f"🚀 ¡Éxito! Se ha generado el archivo '{output_filename}' listo para importar.")

    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo '{input_filename}'.")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")

if __name__ == '__main__':
    generate_init_sql(input_filename='data.json', output_filename='init.sql')