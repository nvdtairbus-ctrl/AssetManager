import subprocess
import json

def fetch_prices():
    try:
        # استفاده از python -m bonbast export
        result = subprocess.run(['python', '-m', 'bonbast', 'export'], 
                                capture_output=True, text=True, timeout=15)
        
        if result.returncode != 0:
            print(f"❌ خطا در اجرا: {result.stderr}")
            return None
        
        # بررسی اینکه خروجی JSON معتبر است یا خیر
        output = result.stdout.strip()
        if not output:
            print("❌ خروجی خالی است")
            return None
        
        data = json.loads(output)
        
        # استخراج قیمت‌های مورد نیاز
        prices = {
            "usd": data.get('USD', {}).get('selling'),
            "eur": data.get('EUR', {}).get('selling'),
            "gbp": data.get('GBP', {}).get('selling'),
            "try": data.get('TRY', {}).get('selling'),
            "aed": data.get('AED', {}).get('selling'),
            "kwd": data.get('KWD', {}).get('selling'),
            "emami_coin": data.get('emami1', {}).get('selling'),
            "gerami_coin": data.get('azadi1g', {}).get('selling'),
            "azadi_coin": data.get('azadi1', {}).get('selling'),
            "nim_coin": data.get('azadi1_2', {}).get('selling'),
            "rob_coin": data.get('azadi1_4', {}).get('selling'),
            "gold_gram": data.get('gol18', {}).get('price'),
            "gold_mithqal": data.get('mithqal', {}).get('price'),
            "ounce": data.get('ounce', {}).get('price'),
            "bitcoin": data.get('bitcoin', {}).get('price'),
        }
        
        # محاسبه طلای 24 عیار
        if prices['gold_gram']:
            prices['gold_24'] = int(prices['gold_gram'] * 24 / 18)
        else:
            prices['gold_24'] = None
        
        with open('prices.json', 'w', encoding='utf-8') as f:
            json.dump(prices, f, indent=2, ensure_ascii=False)
        
        print("✅ قیمت‌ها ذخیره شدند!")
        print(f"💰 دلار: {prices['usd']:,} تومان")
        print(f"💶 یورو: {prices['eur']:,} تومان")
        print(f"🪙 سکه امامی: {prices['emami_coin']:,} تومان")
        print(f"✨ طلا: {prices['gold_gram']:,} تومان")
        
        return prices
        
    except json.JSONDecodeError as e:
        print(f"❌ خطا در解析 JSON: {e}")
        print(f"خروجی دریافت شده: {result.stdout[:200]}...")
        return None
    except Exception as e:
        print(f"❌ خطا: {e}")
        return None

if __name__ == '__main__':
    fetch_prices()