#!/usr/bin/env python3
import json
import subprocess
import sys
import time
from datetime import datetime

def get_bonbast_prices():
    """دریافت قیمت‌ها از Bonbast با استفاده از پکیج bonbast"""
    try:
        # اجرای پکیج bonbast و گرفتن خروجی JSON
        result = subprocess.run(['python', '-m', 'bonbast', 'export'],
                                capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            print("❌ خطا در اجرای bonbast export", file=sys.stderr)
            print(result.stderr, file=sys.stderr)
            return None

        data = json.loads(result.stdout)

        # لیست کامل ارزهای پشتیبانی شده
        currencies = {
            "USD": "usd", "EUR": "eur", "GBP": "gbp", "CHF": "chf",
            "CAD": "cad", "AUD": "aud", "SEK": "sek", "NOK": "nok",
            "RUB": "rub", "THB": "thb", "SGD": "sgd", "HKD": "hkd",
            "AZN": "azn", "AMD": "amd", "DKK": "dkk", "AED": "aed",
            "JPY": "jpy", "TRY": "try", "CNY": "cny", "SAR": "sar",
            "INR": "inr", "MYR": "myr", "AFN": "afn", "KWD": "kwd",
            "IQD": "iqd", "BHD": "bhd", "OMR": "omr", "QAR": "qar"
        }

        prices = {}
        for code, key in currencies.items():
            if code in data and 'sell' in data[code]:
                prices[key] = data[code]['sell']
            else:
                prices[key] = None

        # استخراج سکه‌ها و طلا
        prices["emami_coin"] = data.get('emami1', {}).get('sell')
        prices["nim_coin"] = data.get('azadi1_2', {}).get('sell')
        prices["rob_coin"] = data.get('azadi1_4', {}).get('sell')
        prices["gold"] = data.get('gol18', {}).get('price')
        prices["last_update"] = datetime.now().isoformat()

        return prices

    except subprocess.TimeoutExpired:
        print("❌ خطا: زمان اجرای bonbast به پایان رسید", file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(f"❌ خطا در پردازش JSON: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"❌ خطای غیرمنتظره: {e}", file=sys.stderr)
        return None

def save_prices(prices):
    """ذخیره قیمت‌ها در فایل prices.json"""
    with open('prices.json', 'w', encoding='utf-8') as f:
        json.dump(prices, f, indent=2, ensure_ascii=False)
    print("✅ قیمت‌ها با موفقیت ذخیره شدند!")

if __name__ == '__main__':
    print("🔄 دریافت قیمت‌های لحظه‌ای از Bonbast...")
    prices = get_bonbast_prices()
    if prices:
        save_prices(prices)
        print(f"📅 آخرین بروزرسانی: {prices.get('last_update', 'نامشخص')}")
        print(f"💰 قیمت دلار: {prices.get('usd', 'N/A'):,} تومان")
        sys.exit(0)
    else:
        print("❌ دریافت قیمت‌ها با خطا مواجه شد", file=sys.stderr)
        sys.exit(1)