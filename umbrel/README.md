# WealthHub - Umbrel Integration

This directory contains configuration files for WealthHub integration with Umbrel OS.

## Files

- **umbrel-app.yml**: Main app configuration file for Umbrel
- **icon.svg**: App icon displayed in Umbrel dashboard

## Installing as Umbrel App

There are two ways to install WealthHub on Umbrel:

### Option 1: Official Umbrel App Store (When Available)

Once WealthHub is added to the Umbrel App Store, you can install it directly from the Umbrel dashboard.

### Option 2: Manual Installation (Current Method)

1. SSH into your Umbrel server
2. Clone the repository:
   ```bash
   cd ~/umbrel/app-data
   git clone https://github.com/marpemad/wealthHub.git wealthhub
   cd wealthhub
   ```

3. Start the app:
   ```bash
   sudo docker compose up -d --build
   ```

4. Access at: **http://umbrel.local:8787**

## Icon

The WealthHub icon (`icon.svg`) represents:
- **Bars**: Portfolio assets
- **Upward trend**: Wealth growth
- **Dollar sign**: Financial focus
- **Gradient colors**: Dynamic, modern design matching Umbrel's aesthetic

## Updating

To update WealthHub:

```bash
cd ~/umbrel/app-data/wealthhub
git pull origin main
sudo docker compose up -d --build
```

## Support

For issues or feature requests, visit: https://github.com/marpemad/wealthHub/issues
