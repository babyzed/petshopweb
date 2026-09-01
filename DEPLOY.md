# 🐾 راهنمای دیپلوی پت‌شاپ روی سرور

## پیش‌نیازها

- سرور VPS با حداقل **1GB RAM** (پیشنهاد: 2GB)
- **Ubuntu 22.04** یا **Debian 12**
- **Docker** و **Docker Compose** نصب شده
- یک **دامنه** (مثلاً petshop.ir)
- **SSL Certificate** (رایگان از Let's Encrypt)

## ۱. نصب Docker روی سرور

```bash
# آپدیت سیستم
sudo apt update && sudo apt upgrade -y

# نصب Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# نصب Docker Compose
sudo apt install docker-compose-plugin -y

# اضافه کردن کاربر به گروه docker
sudo usermod -aG docker $USER
```

## ۲. کپی فایل‌ها روی سرور

```bash
# از لوکال به سرور
scp -r petshop/ root@YOUR_SERVER_IP:/opt/petshop

# یا با git
ssh root@YOUR_SERVER_IP
cd /opt
git clone https://github.com/YOUR_USERNAME/petshop.git
```

## ۳. تنظیم .env

```bash
cd /opt/petshop
cp .env.example .env

# ویرایش فایل .env
nano .env
```

مهم‌ترین مقادیر:
```
JWT_SECRET=یک رشته تصادفی_خیلی_طولانی_اینجا_بنویسید
PORT=3000

# درگاه پرداخت فعال: saman | zarinpal | melli | saderat
PAYMENT_GATEWAY=saman
PAYMENT_CALLBACK_URL=https://petshop.ir/api/payments/callback

# اطلاعات درگاه انتخابی (فقط همان درگاه را پر کنید)
SAMAN_TERMINAL_ID=شماره_ترمینال_سامان
ZARINPAL_MERCHANT_ID=کد_۳۶_کاراکتری_زرین‌پال
MELLI_MERCHANT_ID=
MELLI_TERMINAL_ID=
MELLI_TERMINAL_KEY=
SADERAT_TERMINAL_ID=

# پیامک آموت
AMOOT_TOKEN=توکن_رست_آموت
AMOOT_LINE_SERVICE=خط_خدماتی
AMOOT_LINE_ADS=خط_تبلیغاتی
```

> 💡 همهٔ این مقادیر را می‌توانید به‌جای `.env` از **پنل مدیریت → تنظیمات** هم وارد کنید؛
> مقادیر پنل بر `.env` اولویت دارند. آدرس `PAYMENT_CALLBACK_URL` باید در پنل پذیرندگی بانک ثبت شود.

## ۴. ساخت تصویر و اجرا

```bash
cd /opt/petshop

# ساخت تصویر Docker
docker compose up -d --build

# بررسی وضعیت
docker ps
curl http://localhost:3000/
```

## ۵. تنظیم Nginx (Reverse Proxy + SSL)

```bash
# نصب Nginx
sudo apt install nginx certbot python3-certbot-nginx -y

# ساخت فایل Nginx
sudo nano /etc/nginx/sites-available/petshop
```

محتوای فایل:
```nginx
server {
    listen 80;
    server_name petshop.ir www.petshop.ir;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name petshop.ir www.petshop.ir;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/petshop.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/petshop.ir/privkey.pem;

    # امنیت
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # آپلود تصاویر
    client_max_body_size 10M;

    # کش فایل‌های استاتیک
    location ~* \.(jpg|jpeg|png|gif|webp|svg|css|js|ico|woff|woff2)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API و صفحات
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

فعال‌سازی:
```bash
sudo ln -s /etc/nginx/sites-available/petshop /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## ۶. دریافت SSL

```bash
# ابتدا دامنه را به IP سرور وصل کنید (DNS A Record)

# دریافت گواهی SSL
sudo certbot --nginx -d petshop.ir -d www.petshop.ir

# تمدید خودکار
sudo systemctl status certbot.timer
```

## ۷. تنظیم Firewall

```bash
# UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# یا iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dポート 443 -j ACCEPT
```

## ۸. پشتیبان‌گیری خودکار

```bash
# ساخت اسکریپت پشتیبان
sudo nano /opt/petshop/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="/opt/petshop/backups"
mkdir -p $BACKUP_DIR

# پشتیبان دیتابیس
cp /opt/petshop/data/petshop.db $BACKUP_DIR/petshop_$DATE.db

# پشتیبان تصاویر
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/petshop/uploads/

# حذف پشتیبان‌های قدیمی (بیش از ۳۰ روز)
find $BACKUP_DIR -mtime +30 -delete

echo "[$DATE] Backup completed"
```

```bash
chmod +x /opt/petshop/backup.sh

# اجرا هر روز ساعت ۲ شب
sudo crontab -e
# اضافه کنید:
0 2 * * * /opt/petshop/backup.sh >> /var/log/petshop-backup.log 2>&1
```

## ۹. مانیتورینگ

```bash
# بررسی لاگ‌ها
docker logs -f petshop

# بررسی وضعیت
docker ps
curl -s http://localhost:3000/api/settings/public | head -100
```

## ۱۰. آپدیت سایت

```bash
cd /opt/petshop

# کشیدن آخرین تغییرات
git pull

# rebuild و اجرا
docker compose up -d --build

# بررسی
docker logs -f petshop
```

---

## 🔧 عیب‌یابی

### سایت باز نمی‌شود
```bash
docker ps
docker logs petshop
curl http://localhost:3000/
```

### خطای 502 در Nginx
```bash
# آیا Docker اجراست؟
docker ps

# آیا پورت 3000 درست است؟
curl http://localhost:3000/

# لاگ Nginx
sudo tail -f /var/log/nginx/error.log
```

### خطای پرداخت
```bash
# فهرست درگاه‌ها و وضعیت پیکربندی
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/payments/gateways

# تست اتصال یک درگاه مشخص (saman | zarinpal | melli | saderat)
curl -H "Authorization: Bearer YOUR_TOKEN" "http://localhost:3000/api/payments/test?gateway=melli"

# بررسی اطلاعات درگاه‌ها در .env
grep -E "PAYMENT_|SAMAN_|ZARINPAL_|MELLI_|SADERAT_" /opt/petshop/.env
```

### پشتیبان بازیابی
```bash
# بازیابی دیتابیس
cp /opt/petshop/backups/petshop_2024-01-01.db /opt/petshop/data/petshop.db
docker restart petshop
```

---

## 📊 مشخصات سرور پیشنهادی

| تعداد کاربر | RAM | CPU | فضا | هزینه ماهانه |
|-------------|-----|-----|-----|-------------|
| < 100 | 1GB | 1 vCPU | 20GB | ~$5 |
| 100-500 | 2GB | 2 vCPU | 40GB | ~$10 |
| 500-2000 | 4GB | 2 vCPU | 80GB | ~$20 |
| > 2000 | 8GB | 4 vCPU | 160GB | ~$40 |

---

## 🔐 نکات امنیتی مهم

1. **JWT_SECRET** را حتماً عوض کنید
2. **رمز admin** را فوراً تغییر دهید
3. **SSH با کلید** فعال کنید (غیرفعال کردن رمز)
4. **UFW** را فعال کنید
5. **پشتیبان خودکار** تنظیم کنید
6. **SSL** حتماً فعال باشد
7. **DDoS Protection** (Cloudflare رایگان)
