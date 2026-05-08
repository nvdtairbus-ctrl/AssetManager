import requests
import json
import time

# ========== تنظیمات ==========
API_URL = "https://bonbast.com/api/rates"
GITHUB_USER = "nvdtairbus-ctrl"
GITHUB_REPO = "AssetManager"
BRANCH = "main"
PRICES_FILE = "prices.json"

def fetch_and_save_prices():
    try:
        print(f"[{time.ctime()}] در حال دریافت قیمت‌ها...")
        
        # دریافت قیمت از API
        response = requests.get(API_URL, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        # دریافت قیمت دلار (مبنای محاسبات)
        usd_price = int(data.get("usd", {}).get("sell", 0))
        
        # ========== استخراج قیمت‌ها با سیستم Fallback ==========
        eur_price = int(data.get("eur", {}).get("sell", 0))
        if eur_price == 0 and usd_price > 0:
            eur_price = int(usd_price * 1.18)
            print("⚠️ یورو از روی دلار محاسبه شد")
        
        gbp_price = int(data.get("gbp", {}).get("sell", 0))
        if gbp_price == 0 and usd_price > 0:
            gbp_price = int(usd_price * 1.35)
        
        chf_price = int(data.get("chf", {}).get("sell", 0))
        if chf_price == 0 and usd_price > 0:
            chf_price = int(usd_price * 1.12)
        
        cad_price = int(data.get("cad", {}).get("sell", 0))
        if cad_price == 0 and usd_price > 0:
            cad_price = int(usd_price * 0.73)
        
        aud_price = int(data.get("aud", {}).get("sell", 0))
        if aud_price == 0 and usd_price > 0:
            aud_price = int(usd_price * 0.65)
        
        try_price = int(data.get("try", {}).get("sell", 0))
        if try_price == 0 and usd_price > 0:
            try_price = int(usd_price * 0.033)
        
        aed_price = int(data.get("aed", {}).get("sell", 0))
        if aed_price == 0 and usd_price > 0:
            aed_price = int(usd_price * 0.27)
        
        cny_price = int(data.get("cny", {}).get("sell", 0))
        if cny_price == 0 and usd_price > 0:
            cny_price = int(usd_price * 0.14)
        
        sar_price = int(data.get("sar", {}).get("sell", 0))
        if sar_price == 0 and usd_price > 0:
            sar_price = int(usd_price * 0.27)
        
        # ========== سکه‌ها و طلا ==========
        emami_price = int(data.get("emami", {}).get("sell", 0))
        azadi_price = int(data.get("azadi", {}).get("sell", 0))
        nim_price = int(data.get("nim", {}).get("sell", 0))
        rob_price = int(data.get("rob", {}).get("sell", 0))
        gerami_price = int(data.get("gerami", {}).get("sell", 0))
        
        gold_18_price = int(data.get("gold_gram", {}).get("sell", 0))
        gold_24_price = (gold_18_price * 24) // 18 if gold_18_price > 0 else 0
        
        # ========== رمز ارزها ==========
        bitcoin_price = data.get("bitcoin", {}).get("price", None)
        
        # ساخت دیکشنری نهایی
        prices_data = {
            "usd": usd_price,
            "eur": eur_price,
            "gbp": gbp_price,
            "chf": chf_price,
            "cad": cad_price,
            "aud": aud_price,
            "try": try_price,
            "aed": aed_price,
            "cny": cny_price,
            "sar": sar_price,
            "emami_coin": emami_price,
            "azadi_coin": azadi_price,
            "nim_coin": nim_price,
            "rob_coin": rob_price,
            "gerami_coin": gerami_price,
            "gold_18": gold_18_price,
            "gold_24": gold_24_price,
            "bitcoin": bitcoin_price if bitcoin_price else None,
            "last_update": time.ctime()
        }
        
        # ذخیره در فایل
        with open(PRICES_FILE, 'w', encoding='utf-8') as f:
            json.dump(prices_data, f, indent=2, ensure_ascii=False)
        
        print("✅ قیمت‌ها با موفقیت ذخیره شدند!")
        print(f"💰 دلار: {usd_price:,} تومان")
        print(f"💶 یورو: {eur_price:,} تومان")
        print(f"🪙 سکه امامی: {emami_price:,} تومان")
        print(f"✨ طلای ۱۸ عیار: {gold_18_price:,} تومان")
        print(f"📅 آخرین بروزرسانی: {prices_data['last_update']}")
        
        return True
    except Exception as e:
        print(f"❌ خطا: {e}")
        return False

if __name__ == "__main__":
    fetch_and_save_prices()