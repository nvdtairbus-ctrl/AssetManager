import subprocess
import json

def get_bonbast_prices():
    try:
        print("🔄 در حال دریافت قیمت‌ها از bonbast...")
        
        # اجرای دستور bonbast export و گرفتن خروجی JSON
        result = subprocess.run(['python', '-m', 'bonbast', 'export'], 
                                capture_output=True, text=True, timeout=15)
        
        if result.returncode != 0:
            print("❌ خطا در اجرای bonbast export")
            print(result.stderr)
            return None
        
        # Parse خروجی JSON
        data = json.loads(result.stdout)
        
        # استخراج قیمت‌های مورد نیاز
        prices = {
            "usd": data.get('USD', {}).get('sell'),
            "eur": data.get('EUR', {}).get('sell'),
            "gold": data.get('gol18', {}).get('price'),
            "emami_coin": data.get('emami1', {}).get('sell'),
            "nim_coin": data.get('azadi1_2', {}).get('sell'),
            "rob_coin": data.get('azadi1_4', {}).get('sell'),
        }
        
        # ذخیره در فایل prices.json برای برنامه موبایل
        with open('prices.json', 'w', encoding='utf-8') as f:
            json.dump(prices, f, indent=2, ensure_ascii=False)
        
        print("✅ قیمت‌ها با موفقیت ذخیره شدند!")
        print("=" * 45)
        print(f"💰 دلار آمریکا: {prices['usd']:,} تومان")
        print(f"💶 یورو: {prices['eur']:,} تومان")
        print(f"🪙 سکه امامی: {prices['emami_coin']:,} تومان")
        print(f"🪙 نیم سکه: {prices['nim_coin']:,} تومان")
        print(f"🪙 ربع سکه: {prices['rob_coin']:,} تومان")
        print(f"✨ طلای ۱۸ عیار: {prices['gold']:,} تومان")
        print("=" * 45)
        
        return prices
        
    except Exception as e:
        print(f"❌ خطا: {e}")
        return None

if __name__ == '__main__':
    get_bonbast_prices()