import subprocess
import json
import re

def fetch_all_prices():
    """دریافت همه قیمت‌ها از خروجی bonbast با regex"""
    try:
        result = subprocess.run(['python', '-m', 'bonbast'], 
                                capture_output=True, text=True, timeout=15)
        output = result.stdout
        
        # ========== ارزها (Currencies) ==========
        # الگوی دقیق‌تر برای دلار - ستون Sell (سومین عدد)
        usd_match = re.search(r'USD\s*\|\s*US Dollar\s*\|\s*([\d,]+)', output)
        eur_match = re.search(r'EUR\s*\|\s*Euro\s*\|\s*([\d,]+)', output)
        gbp_match = re.search(r'GBP\s*\|\s*British Pound\s*\|\s*([\d,]+)', output)
        try_match = re.search(r'TRY\s*\|\s*Turkish Lira\s*\|\s*([\d,]+)', output)
        aed_match = re.search(r'AED\s*\|\s*UAE Dirham\s*\|\s*([\d,]+)', output)
        kwd_match = re.search(r'KWD\s*\|\s*Kuwaiti Dinar\s*\|\s*([\d,]+)', output)
        
        # ========== سکه‌ها (Coins) ==========
        emami_match = re.search(r'Emami\s*\|\s*([\d,]+)', output)
        gerami_match = re.search(r'Gerami\s*\|\s*([\d,]+)', output)
        azadi_match = re.search(r'Azadi\s*\|\s*([\d,]+)', output)
        nim_match = re.search(r'½ Azadi\s*\|\s*([\d,]+)', output)
        rob_match = re.search(r'¼ Azadi\s*\|\s*([\d,]+)', output)
        
        # ========== طلا (Gold) ==========
        gold_gram_match = re.search(r'Gold Gram\s*\|\s*([\d,]+)', output)
        gold_mithqal_match = re.search(r'Gold Mithqal\s*\|\s*([\d,]+)', output)
        ounce_match = re.search(r'Ounce\s*\|\s*([\d,]+(?:\.\d+)?)', output)
        bitcoin_match = re.search(r'Bitcoin\s*\|\s*([\d,]+(?:\.\d+)?)', output)
        
        def to_int(match):
            if match:
                return int(match.group(1).replace(',', ''))
            return None
        
        def to_float(match):
            if match:
                return float(match.group(1).replace(',', ''))
            return None
        
        prices = {
            # ارزها
            "usd": to_int(usd_match),
            "eur": to_int(eur_match),
            "gbp": to_int(gbp_match),
            "try": to_int(try_match),
            "aed": to_int(aed_match),
            "kwd": to_int(kwd_match),
            
            # سکه‌ها
            "emami_coin": to_int(emami_match),
            "gerami_coin": to_int(gerami_match),
            "azadi_coin": to_int(azadi_match),
            "nim_coin": to_int(nim_match),
            "rob_coin": to_int(rob_match),
            
            # طلا
            "gold_gram": to_int(gold_gram_match),
            "gold_mithqal": to_int(gold_mithqal_match),
            "ounce": to_float(ounce_match),
            "bitcoin": to_float(bitcoin_match),
        }
        
        # محاسبه طلای 24 عیار
        if prices['gold_gram']:
            prices['gold_24'] = int(prices['gold_gram'] * 24 / 18)
        else:
            prices['gold_24'] = None
        
        return prices
        
    except Exception as e:
        print(f"❌ خطا در استخراج: {e}")
        return None

def safe_format(value):
    if value is None:
        return "در حال دریافت..."
    if isinstance(value, float):
        return f"{value:,.2f}"
    return f"{value:,}"

def main():
    print("🔄 دریافت همه قیمت‌ها از bonbast...")
    prices = fetch_all_prices()
    
    if not prices:
        print("❌ خطا در دریافت قیمت‌ها")
        return
    
    # حذف کلیدهای None از فایل JSON (اختیاری)
    cleaned_prices = {k: v for k, v in prices.items() if v is not None}
    
    with open('prices.json', 'w', encoding='utf-8') as f:
        json.dump(cleaned_prices, f, indent=2, ensure_ascii=False)
    
    print("\n✅ قیمت‌ها ذخیره شدند!")
    print("=" * 60)
    print("📊 ارزها:")
    print(f"   USD (دلار آمریکا): {safe_format(prices['usd'])} تومان")
    print(f"   EUR (یورو): {safe_format(prices['eur'])} تومان")
    print(f"   GBP (پوند انگلیس): {safe_format(prices['gbp'])} تومان")
    print(f"   TRY (لیر ترکیه): {safe_format(prices['try'])} تومان")
    print(f"   AED (درهم امارات): {safe_format(prices['aed'])} تومان")
    print(f"   KWD (دینار کویت): {safe_format(prices['kwd'])} تومان")
    print("=" * 60)
    print("🪙 سکه‌ها:")
    print(f"   سکه امامی: {safe_format(prices['emami_coin'])} تومان")
    print(f"   سکه بهار آزادی: {safe_format(prices['azadi_coin'])} تومان")
    print(f"   نیم سکه: {safe_format(prices['nim_coin'])} تومان")
    print(f"   ربع سکه: {safe_format(prices['rob_coin'])} تومان")
    print(f"   سکه گرمی: {safe_format(prices['gerami_coin'])} تومان")
    print("=" * 60)
    print("✨ طلا:")
    print(f"   طلای ۱۸ عیار: {safe_format(prices['gold_gram'])} تومان")
    print(f"   طلای ۲۴ عیار: {safe_format(prices['gold_24'])} تومان")
    print(f"   مثقال طلا: {safe_format(prices['gold_mithqal'])} تومان")
    print(f"   انس طلا: {safe_format(prices['ounce'])} دلار")
    print(f"   بیت‌کوین: {safe_format(prices['bitcoin'])} دلار")
    print("=" * 60)

if __name__ == '__main__':
    main()