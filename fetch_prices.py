#!/usr/bin/env python3
import json
import subprocess
import sys
from datetime import datetime, timezone, timedelta

def get_tehran_time():
    tehran_tz = timezone(timedelta(hours=3, minutes=30))
    return datetime.now(tehran_tz).isoformat()

def get_price_with_fallback():
    try:
        result = subprocess.run(['python', '-m', 'bonbast', 'export'],
                                capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return get_fallback_prices()
        data = json.loads(result.stdout)
        currencies = {
            "usd": "usd", "eur": "eur", "gbp": "gbp", "chf": "chf",
            "cad": "cad", "aud": "aud", "sek": "sek", "nok": "nok",
            "rub": "rub", "thb": "thb", "sgd": "sgd", "hkd": "hkd",
            "azn": "azn", "amd": "amd", "dkk": "dkk", "aed": "aed",
            "jpy": "jpy", "try": "try", "cny": "cny", "sar": "sar",
            "inr": "inr", "myr": "myr", "afn": "afn", "kwd": "kwd",
            "iqd": "iqd", "bhd": "bhd", "omr": "omr", "qar": "qar"
        }
        prices = {}
        for code, key in currencies.items():
            if code in data and 'sell' in data[code]:
                prices[key] = data[code]['sell']
            else:
                prices[key] = None
        prices["emami_coin"] = data.get('emami1', {}).get('sell')
        prices["nim_coin"] = data.get('azadi1_2', {}).get('sell')
        prices["rob_coin"] = data.get('azadi1_4', {}).get('sell')
        prices["gold"] = data.get('gol18', {}).get('price')
        if prices.get('eur') is None and prices.get('usd') is not None:
            prices['eur'] = int(prices['usd'] * 1.18)
        prices["last_update"] = get_tehran_time()
        return prices
    except Exception as e:
        return get_fallback_prices()

def get_fallback_prices():
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

def save_prices(prices):
    with open('prices.json', 'w', encoding='utf-8') as f:
        json.dump(prices, f, indent=2, ensure_ascii=False)
    print("✅ قیمت‌ها ذخیره شدند")

if __name__ == '__main__':
    prices = get_price_with_fallback()
    save_prices(prices)
    print(f"دلار: {prices['usd']:,} تومان")
    sys.exit(0)