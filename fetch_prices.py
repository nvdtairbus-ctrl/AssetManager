#!/usr/bin/env python3
"""
اسکریپت دریافت قیمت‌های لحظه‌ای از Bonbast
قابلیت دریافت ۲۸ ارز مختلف + منطق جایگزین برای یورو
"""

import json
import subprocess
import sys
import re
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

        # Parse خروجی JSON
        data = json.loads(result.stdout)

        # استخراج همه ارزهای موجود
        # لیست کامل ارزها بر اساس مستندات bonbast [citation:6]
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

        # استخراج قیمت هر ارز
        for code, key in currencies.items():
            if code in data and 'sell' in data[code]:
                prices[key] = data[code]['sell']
            else:
                prices[key] = None

        # استخراج قیمت سکه‌ها و طلا
        prices["emami_coin"] = data.get('emami1', {}).get('sell')
        prices["nim_coin"] = data.get('azadi1_2', {}).get('sell')
        prices["rob_coin"] = data.get('azadi1_4', {}).get('sell')
        prices["gold"] = data.get('gol18', {}).get('price')

        # اضافه کردن زمان آخرین بروزرسانی
        prices["last_update"] = datetime.now().isoformat()

        # منطق جایگزین برای یورو: اگر دریافت نشد، از روی دلار محاسبه کن
        if prices.get('eur') is None and prices.get('usd') is not None:
            # نرخ تقریبی یورو به دلار (۱.۱۸) - این مقدار تقریبی است
            # می‌توانید از یک API دیگر یا نرخ ثابت استفاده کنید
            prices['eur'] = int(prices['usd'] * 1.18)
            print("⚠️ یورو از روی دلار محاسبه شد (تقریبی)", file=sys.stderr)

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
    try:
        with open('prices.json', 'w', encoding='utf-8') as f:
            json.dump(prices, f, indent=2, ensure_ascii=False)
        print("✅ قیمت‌ها با موفقیت ذخیره شدند!")
        return True
    except Exception as e:
        print(f"❌ خطا در ذخیره‌سازی: {e}", file=sys.stderr)
        return False

def display_prices(prices):
    """نمایش قیمت‌های مهم در خروجی"""
    print("\n" + "=" * 50)
    print("💰 قیمت‌های لحظه‌ای از Bonbast")
    print("=" * 50)

    important = [
        ('usd', 'دلار آمریکا'),
        ('eur', 'یورو'),
        ('try', 'لیر ترکیه'),
        ('aed', 'درهم امارات'),
        ('kwd', 'دینار کویت')
    ]

    for key, name in important:
        if prices.get(key):
            print(f"{name}: {prices[key]:,} تومان")

    if prices.get('gold'):
        print(f"طلای ۱۸ عیار: {prices['gold']:,} تومان")
    if prices.get('emami_coin'):
        print(f"سکه امامی: {prices['emami_coin']:,} تومان")

    print("=" * 50)
    print(f"🕐 آخرین بروزرسانی: {prices.get('last_update', 'نامشخص')}")

def main():
    print("🔄 در حال دریافت قیمت‌ها از Bonbast...")
    prices = get_bonbast_prices()

    if prices:
        save_prices(prices)
        display_prices(prices)
        sys.exit(0)
    else:
        print("❌ دریافت قیمت‌ها با خطا مواجه شد", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()