#!/bin/bash

# Tạo thư mục ssl nếu chưa tồn tại
mkdir -p ssl

# Tạo private key
openssl genrsa -out ssl/key.pem 2048

# Tạo certificate signing request
openssl req -new -key ssl/key.pem -out ssl/csr.pem -subj "/C=VN/ST=HCM/L=HoChiMinh/O=LandAuctionSystem/OU=Development/CN=localhost"

# Tạo self-signed certificate
openssl x509 -req -days 365 -in ssl/csr.pem -signkey ssl/key.pem -out ssl/cert.pem

# Xóa CSR file
rm ssl/csr.pem

echo "✅ SSL Certificates đã được tạo trong thư mục ssl/"
echo "🔒 Có thể chạy server với HTTPS: npm run dev:https"
echo "⚠️  Self-signed certificate - browser sẽ hiện warning, chọn 'Advanced' -> 'Proceed to localhost'"