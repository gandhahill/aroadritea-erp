#!/bin/bash
sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://aroadritea:local_erp_s3cr3t_2026@127.0.0.1:5432/aroadritea_erp"|' /home/aroadritea/web/aroadritea.com/public_html/aroadritea-erp/.env
