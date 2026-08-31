#!/bin/bash
# ============================================================
# پت‌شاپ — اسکریپت بکاپ دیتابیس SQLite
# استفاده: ./scripts/backup.sh
# cron: 0 2 * * * cd /path/to/petshop && ./scripts/backup.sh
# ============================================================

set -e

# تنظیمات
DATA_DIR="./data"
BACKUP_DIR="./backups"
DB_FILE="$DATA_DIR/petshop.db"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/petshop_$DATE.db"

# ایجاد دایرکتوری بکاپ
mkdir -p "$BACKUP_DIR"

# بررسی وجود دیتابیس
if [ ! -f "$DB_FILE" ]; then
  echo "[Backup] Error: Database file not found at $DB_FILE"
  exit 1
fi

# بکاپ امن SQLite (hot backup)
echo "[Backup] Starting backup..."
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[Backup] Success: $BACKUP_FILE ($SIZE)"
else
  echo "[Backup] Error: Backup file not created"
  exit 1
fi

# فشرده‌سازی
gzip "$BACKUP_FILE"
echo "[Backup] Compressed: ${BACKUP_FILE}.gz"

# حذف بکاپ‌های قدیمی‌تر از RETENTION_DAYS روز
echo "[Backup] Cleaning old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "petshop_*.db.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# نمایش بکاپ‌های فعلی
echo "[Backup] Current backups:"
ls -lh "$BACKUP_DIR"/petshop_*.db.gz 2>/dev/null | tail -5

echo "[Backup] Done."
