#!/usr/bin/env python3
import json
import subprocess
import sys
from datetime import datetime, timezone, timedelta

def get_tehran_time():
    tehran_tz = timezone(timedelta(hours=3, minutes=30))
    return datetime.now(tehran_tz).isoformat()

def get_fallback_prices():
    """قیمت‌های پیش‌فرض در صورت عدم دسترسی"""
    return {
        "usd": 178000, "eur": 209500, "gbp": 242500, "chf": 228800,
        "cad": 130000, "aud": 129000, "sek": 19300, "nok": 19300,
        "rub": 2400, "thb": 5520, "sgd": 140300, "hkd": 22700,
        "azn": 104350, "amd": 4825, "dkk": 28050, "aed": 48600,
        "jpy": 11350, "try": 3920, "cny": 26150, "sar": 47200,
        "inr": 1880, "myr": 45350, "afn": 2780, "kwd": 577900,
        "iqd": 13600, "bhd": 472150, "omr": 462200, "qar": 48750,
        "emami_coin": 195500000, "nim_coin": 100000000,
        "rob_coin": 55000000, "gold": 20294334,
        "last_update": get_tehran_time()
    }

def get_prices():
    try:
        result = subprocess.run(['python', '-m', 'bonbast', 'export'],
                                capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print("⚠️ خطا در bonbast، استفاده از fallback", file=sys.stderr)
            return get_fallback_prices()
        
        data = json.loads(result.stdout)
        
        # بررسی وجود داده
        if not data or 'usd' not in data or not data['usd'].get('sell'):
            print("⚠️ داده bonbast ناقص است، استفاده از fallback", file=sys.stderr)
            return get_fallback_prices()
        
        prices = {
            "usd": data['usd']['sell'],
            "eur": data.get('eur', {}).get('sell') or 0,
            "gbp": data.get('gbp', {}).get('sell') or 0,
            "chf": data.get('chf', {}).get('sell') or 0,
            "cad": data.get('cad', {}).get('sell') or 0,
            "aud": data.get('aud', {}).get('sell') or 0,
            "sek": data.get('sek', {}).get('sell') or 0,
            "nok": data.get('nok', {}).get('sell') or 0,
            "rub": data.get('rub', {}).get('sell') or 0,
            "thb": data.get('thb', {}).get('sell') or 0,
            "sgd": data.get('sgd', {}).get('sell') or 0,
            "hkd": data.get('hkd', {}).get('sell') or 0,
            "azn": data.get('azn', {}).get('sell') or 0,
            "amd": data.get('amd', {}).get('sell') or 0,
            "dkk": data.get('dkk', {}).get('sell') or 0,
            "aed": data.get('aed', {}).get('sell') or 0,
            "jpy": data.get('jpy', {}).get('sell') or 0,
            "try": data.get('try', {}).get('sell') or 0,
            "cny": data.get('cny', {}).get('sell') or 0,
            "sar": data.get('sar', {}).get('sell') or 0,
            "inr": data.get('inr', {}).get('sell') or 0,
            "myr": data.get('myr', {}).get('sell') or 0,
            "afn": data.get('afn', {}).get('sell') or 0,
            "kwd": data.get('kwd', {}).get('sell') or 0,
            "iqd": data.get('iqd', {}).get('sell') or 0,
            "bhd": data.get('bhd', {}).get('sell') or 0,
            "omr": data.get('omr', {}).get('sell') or 0,
            "qar": data.get('qar', {}).get('sell') or 0,
            "emami_coin": data.get('emami1', {}).get('sell') or 0,
            "nim_coin": data.get('azadi1_2', {}).get('sell') or 0,
            "rob_coin": data.get('azadi1_4', {}).get('sell') or 0,
            "gold": data.get('gol18', {}).get('price') or 0,
            "last_update": get_tehran_time()
        }
        
        # بررسی موفقیت
        if prices['usd'] and prices['usd'] > 0:
            return prices
        else:
            print("⚠️ قیمت دلار دریافت نشد، استفاده از fallback", file=sys.stderr)
            return get_fallback_prices()
            
    except Exception as e:
        print(f"❌ خطا: {e}", file=sys.stderr)
        return get_fallback_prices()

def save_prices(prices):
    with open('prices.json', 'w', encoding='utf-8') as f:
        json.dump(prices, f, indent=2, ensure_ascii=False)
    print("✅ قیمت‌ها ذخیره شدند")

if __name__ == '__main__':
    prices = get_prices()
    save_prices(prices)
    print(f"دلار: {prices['usd']:,} تومان")
    print(f"یورو: {prices['eur']:,} تومان")
    print(f"طلای ۱۸ عیار: {prices['gold']:,} تومان")
    sys.exit(0)