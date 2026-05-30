#!/bin/bash
sudo -u postgres psql -c "CREATE USER aroadritea WITH PASSWORD 'local_erp_s3cr3t_2026';"
sudo -u postgres psql -c "CREATE DATABASE aroadritea_erp OWNER aroadritea;"
