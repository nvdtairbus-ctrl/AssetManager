// App.js - نسخه نهایی کامل با تمام بهبودها

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  SafeAreaView,
  Dimensions,
  Platform,
  ActivityIndicator,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  BackHandler,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as jalaali from 'jalaali-js';

let ExpoVpnChecker = null;
try { ExpoVpnChecker = require('expo-vpn-checker').default; } catch (e) {}

const { width, height } = Dimensions.get('window');

// ==================== VERSION ====================
const DATA_VERSION = 3;
const APP_VERSION = '2.5.0';

const migrateAsset = (asset) => {
  let m = { ...asset };
  const v = m._dataVersion || 1;
  if (v < 2) m.ownership = m.ownership || 'personal';
  if (v < 3) {
    if (!m.buyDateJalaali && m.buyDate) m.buyDateJalaali = gregorianToJalaali(m.buyDate);
    if (['حساب بانکی', 'پول نقد'].includes(m.type)) m.quantity = 1;
  }
  m._dataVersion = DATA_VERSION;
  return m;
};

// ==================== JALAALI HELPERS ====================
const JALAALI_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

const getJalaaliDate = (date = new Date()) => {
  const jd = jalaali.toJalaali(date);
  return `${jd.jy}/${String(jd.jm).padStart(2,'0')}/${String(jd.jd).padStart(2,'0')}`;
};

const getIranTime = (utcDate) => {
  const t = new Date(utcDate.getTime() + 3.5 * 3600000);
  return {
    time: `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}`,
    date: getJalaaliDate(t)
  };
};

const gregorianToJalaali = (gDate) => {
  if (!gDate) return '';
  const p = gDate.split('-');
  if (p.length !== 3) return gDate;
  const j = jalaali.toJalaali(+p[0], +p[1], +p[2]);
  return `${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')}`;
};

const jalaaliToGregorian = (jDate) => {
  if (!jDate) return '';
  const p = jDate.split('/');
  if (p.length !== 3) return jDate;
  try {
    const g = jalaali.toGregorian(+p[0], +p[1], +p[2]);
    return `${g.gy}-${String(g.gm).padStart(2,'0')}-${String(g.gd).padStart(2,'0')}`;
  } catch { return ''; }
};

const isValidJalaaliDate = (jDate) => {
  if (!jDate) return false;
  const p = jDate.split('/');
  if (p.length !== 3) return false;
  const [jy, jm, jd] = p.map(Number);
  if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return false;
  if (jy < 1300 || jy > 1450) return false;
  if (jm < 1 || jm > 12) return false;
  if (jd < 1 || jd > 31) return false;
  if (jm > 6 && jd > 30) return false;
  if (jm === 12 && jd > 29 && !jalaali.isLeapJalaaliYear(jy)) return false;
  return true;
};

const getTodayJalaali = () => getJalaaliDate(new Date());

// ==================== ID ====================
let _idC = 0;
const uid = () => `${Date.now()}_${++_idC}_${Math.random().toString(36).substr(2,5)}`;

// ==================== CONSTANTS ====================
const CURRENCY_CONFIG = {
  USD:{flag:'🇺🇸',name:'دلار آمریکا',g:'main'},EUR:{flag:'🇪🇺',name:'یورو',g:'main'},
  GBP:{flag:'🇬🇧',name:'پوند انگلیس',g:'main'},CHF:{flag:'🇨🇭',name:'فرانک سوئیس',g:'main'},
  CAD:{flag:'🇨🇦',name:'دلار کانادا',g:'main'},AUD:{flag:'🇦🇺',name:'دلار استرالیا',g:'main'},
  SEK:{flag:'🇸🇪',name:'کرون سوئد',g:'main'},NOK:{flag:'🇳🇴',name:'کرون نروژ',g:'main'},
  RUB:{flag:'🇷🇺',name:'روبل روسیه',g:'main'},THB:{flag:'🇹🇭',name:'بات تایلند',g:'main'},
  SGD:{flag:'🇸🇬',name:'دلار سنگاپور',g:'other'},HKD:{flag:'🇭🇰',name:'دلار هنگ‌کنگ',g:'other'},
  AZN:{flag:'🇦🇿',name:'منات آذربایجان',g:'other'},AMD:{flag:'🇦🇲',name:'درام ارمنستان',g:'other'},
  DKK:{flag:'🇩🇰',name:'کرون دانمارک',g:'other'},AED:{flag:'🇦🇪',name:'درهم امارات',g:'other'},
  JPY:{flag:'🇯🇵',name:'ین ژاپن',g:'other'},TRY:{flag:'🇹🇷',name:'لیر ترکیه',g:'other'},
  CNY:{flag:'🇨🇳',name:'یوان چین',g:'other'},SAR:{flag:'🇸🇦',name:'ریال سعودی',g:'other'},
  INR:{flag:'🇮🇳',name:'روپیه هند',g:'other'},MYR:{flag:'🇲🇾',name:'رینگیت مالزی',g:'other'},
  AFN:{flag:'🇦🇫',name:'افغانی',g:'other'},KWD:{flag:'🇰🇼',name:'دینار کویت',g:'other'},
  IQD:{flag:'🇮🇶',name:'دینار عراق',g:'other'},BHD:{flag:'🇧🇭',name:'دینار بحرین',g:'other'},
  OMR:{flag:'🇴🇲',name:'ریال عمان',g:'other'},QAR:{flag:'🇶🇦',name:'ریال قطر',g:'other'},
};
const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_CONFIG);
const MAIN_CURRENCIES = SUPPORTED_CURRENCIES.filter(c=>CURRENCY_CONFIG[c].g==='main');
const OTHER_CURRENCIES = SUPPORTED_CURRENCIES.filter(c=>CURRENCY_CONFIG[c].g==='other');
const COIN_TYPES = ['سکه امامی','بهار آزادی','نیم سکه','ربع سکه','سکه گرمی'];
const ASSET_TYPES = ['حساب بانکی','پول نقد','ارز','سکه','طلا','اوراق بهادار و سهام','سایر'];
const ASSET_ICONS = {'حساب بانکی':'🏦','پول نقد':'💰','ارز':'💵','سکه':'🪙','طلا':'🥇','اوراق بهادار و سهام':'📈','سایر':'📦'};
const ASSET_COLORS = {'حساب بانکی':'#3b82f6','پول نقد':'#10b981','ارز':'#f59e0b','سکه':'#8b5cf6','طلا':'#eab308','اوراق بهادار و سهام':'#ef4444','سایر':'#64748b'};
const SORT_OPTIONS = [
  {id:'value_desc',label:'بیشترین ارزش'},
  {id:'value_asc',label:'کمترین ارزش'},
  {id:'date_desc',label:'جدیدترین'},
  {id:'date_asc',label:'قدیمی‌ترین'},
  {id:'profit_desc',label:'بیشترین سود'},
  {id:'profit_asc',label:'بیشترین زیان'},
  {id:'name_asc',label:'نام (الف-ی)'},
];

const gf = c => CURRENCY_CONFIG[c]?.flag||'💱';
const gn = c => CURRENCY_CONFIG[c]?.name||c;
const gi = t => ASSET_ICONS[t]||'📦';
const gc = t => ASSET_COLORS[t]||'#64748b';

// ==================== FORMATTERS ====================
const fmt = n => { if(n==null||isNaN(n))return'N/A'; return Math.round(n).toLocaleString('fa-IR'); };
const fmtUSD = a => { if(a==null||isNaN(a))return'N/A'; return `$${Math.round(a).toLocaleString('en-US')}`; };
const fmtCompact = n => {
  if(n==null)return'N/A';
  if(n>=1e12)return`${(n/1e12).toFixed(1)} هزار میلیارد`;
  if(n>=1e9)return`${(n/1e9).toFixed(1)} میلیارد`;
  if(n>=1e6)return`${(n/1e6).toFixed(1)} میلیون`;
  return Math.round(n).toLocaleString('fa-IR');
};

const validateAsset = a => {
  const e = [];
  if(!a.type) e.push('نوع دارایی الزامی است');
  if(!a.detail && !['حساب بانکی','پول نقد','سایر'].includes(a.type)) e.push('جزئیات دارایی الزامی است');
  if(a.type==='ارز' && !SUPPORTED_CURRENCIES.includes(a.detail)) e.push('نوع ارز معتبر نیست');
  if(a.quantity!=null && a.quantity<0) e.push('مقدار نمی‌تواند منفی باشد');
  if(a.buyPriceTotal!=null && a.buyPriceTotal<0) e.push('قیمت خرید نمی‌تواند منفی باشد');
  if(a.buyDateJalaali && !isValidJalaaliDate(a.buyDateJalaali)) e.push('تاریخ خرید معتبر نیست');
  return e;
};

const DEFAULT_PRICES = {
  USD:0,EUR:0,GBP:0,CHF:0,CAD:0,AUD:0,SEK:0,NOK:0,RUB:0,THB:0,
  SGD:0,HKD:0,AZN:0,AMD:0,DKK:0,AED:0,JPY:0,TRY:0,CNY:0,SAR:0,
  INR:0,MYR:0,AFN:0,KWD:0,IQD:0,BHD:0,OMR:0,QAR:0,
  GOLD_18_PER_GRAM:0,GOLD_24_PER_GRAM:0,
  COIN_EMAMI:0,COIN_NIM:0,COIN_ROB:0,COIN_GERAMI:0,COIN_BAHAR:0,
};

// ==================== COMPONENTS ====================

// --- Jalaali Date Picker ---
const JalaaliDatePicker = React.memo(({ value, onChange, pickerKey }) => {
  const today = jalaali.toJalaali(new Date());
  const [show, setShow] = useState(false);
  const [y, setY] = useState(String(today.jy));
  const [m, setM] = useState(String(today.jm));
  const [d, setD] = useState(String(today.jd));

  useEffect(() => {
    if (value) {
      const p = value.split('/');
      if (p.length === 3) { setY(p[0]); setM(String(+p[1])); setD(String(+p[2])); }
    }
  }, [value, pickerKey]);

  const years = useMemo(() => {
    const arr = [];
    for (let i = today.jy + 10; i >= 1380; i--) arr.push(i);
    return arr;
  }, []);

  const maxDay = useMemo(() => {
    const mi = +m;
    if (mi <= 6) return 31;
    if (mi <= 11) return 30;
    return jalaali.isLeapJalaaliYear(+y) ? 30 : 29;
  }, [y, m]);

  const days = useMemo(() => Array.from({length:maxDay},(_,i)=>i+1), [maxDay]);

  useEffect(() => { if(+d > maxDay) setD(String(maxDay)); }, [maxDay]);

  const apply = () => {
    const ds = `${y}/${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
    if (isValidJalaaliDate(ds)) { onChange(ds); setShow(false); }
    else Alert.alert('خطا','تاریخ وارد شده معتبر نیست');
  };

  return (
    <View>
      <TouchableOpacity style={s.dateBtn} onPress={()=>setShow(!show)}>
        <Text style={s.dateBtnIcon}>📅</Text>
        <Text style={s.dateBtnText}>
          {value ? `${value} (${JALAALI_MONTHS[+value.split('/')[1]-1]||''})` : 'انتخاب تاریخ شمسی'}
        </Text>
        <Text style={s.dateBtnArrow}>{show ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {show && (
        <Animated.View style={s.jpContainer}>
          <Text style={s.jpTitle}>📅 انتخاب تاریخ شمسی</Text>
          <View style={s.jpRow}>
            <View style={s.jpCol}>
              <Text style={s.jpLabel}>سال</Text>
              <ScrollView style={s.jpScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {years.map(yr=>(
                  <TouchableOpacity key={yr} style={[s.jpItem,+y===yr&&s.jpItemActive]} onPress={()=>setY(String(yr))}>
                    <Text style={[s.jpItemText,+y===yr&&s.jpItemTextActive]}>{yr}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={s.jpCol}>
              <Text style={s.jpLabel}>ماه</Text>
              <ScrollView style={s.jpScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {JALAALI_MONTHS.map((mn,i)=>(
                  <TouchableOpacity key={i} style={[s.jpItem,+m===i+1&&s.jpItemActive]} onPress={()=>setM(String(i+1))}>
                    <Text style={[s.jpItemText,+m===i+1&&s.jpItemTextActive]}>{mn}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={s.jpCol}>
              <Text style={s.jpLabel}>روز</Text>
              <ScrollView style={s.jpScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {days.map(dy=>(
                  <TouchableOpacity key={dy} style={[s.jpItem,+d===dy&&s.jpItemActive]} onPress={()=>setD(String(dy))}>
                    <Text style={[s.jpItemText,+d===dy&&s.jpItemTextActive]}>{dy}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={s.jpActions}>
            <TouchableOpacity style={s.jpCancel} onPress={()=>setShow(false)}>
              <Text style={s.jpCancelText}>انصراف</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.jpConfirm} onPress={apply}>
              <Text style={s.jpConfirmText}>✓ تأیید</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
});

// --- Asset Item ---
const AssetItem = React.memo(({ asset, currentPrice, unitPrice, profitLoss, onPress, onDelete, usdRate }) => {
  const isFixed = ['حساب بانکی','پول نقد','سایر'].includes(asset.type);
  const currentValue = isFixed ? (asset.buyPriceTotal||0) : (currentPrice ? currentPrice*asset.quantity : asset.buyPriceTotal);
  const isProfit = profitLoss?.profit >= 0;
  const displayDate = asset.buyDateJalaali || (asset.buyDate ? gregorianToJalaali(asset.buyDate) : '');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[s.assetItemWrap, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange:[0,1], outputRange:[20,0] }) }] }]}>
      <TouchableOpacity style={s.assetItem} onPress={onPress} activeOpacity={0.7}>
        <View style={s.assetRow}>
          <View style={[s.assetIcon, { backgroundColor: `${gc(asset.type)}12` }]}>  
            <Text style={s.assetIconText}>{gi(asset.type)}</Text>
            <View style={[s.ownerBadge, { borderColor: asset.ownership==='corporate'?'#f59e0b':'#3b82f6' }]}>
              <Text style={s.ownerBadgeText}>{asset.ownership==='corporate'?'🏢':'👤'}</Text>
            </View>
          </View>
          <View style={s.assetInfo}>
            <View style={s.assetHeaderRow}>
              <Text style={[s.assetType, { color: gc(asset.type) }]}>{asset.type}</Text>
              <View style={[s.ownerTag, asset.ownership==='corporate'?s.corpTag:s.persTag]}>
                <Text style={[s.ownerTagText, asset.ownership==='corporate'?s.corpTagText:s.persTagText]}>
                  {asset.ownership==='corporate'?'شرکتی':'شخصی'}
                </Text>
              </View>
            </View>
            <Text style={s.assetDetail}>
              {asset.type==='ارز'?`${gf(asset.detail)} ${asset.detail}`:asset.detail}
            </Text>
            <View style={s.assetMeta}>
              {asset.type==='ارز'&&<Text style={s.metaText}>💱 {asset.quantity} واحد</Text>}
              {asset.type==='سکه'&&<Text style={s.metaText}>🪙 {asset.quantity} عدد</Text>}
              {asset.type==='طلا'&&<Text style={s.metaText}>⚖️ {asset.quantity} گرم</Text>}
              {asset.type==='اوراق بهادار و سهام'&&<Text style={s.metaText}>📊 {asset.quantity} سهم</Text>}
              {displayDate?<Text style={s.metaText}>📅 {displayDate}</Text>:null}
            </View>
            {!isFixed && unitPrice > 0 && (
              <Text style={s.unitPriceText}>هر واحد: {fmt(unitPrice)} ت</Text>
            )}
            {asset.description?<Text style={s.descText} numberOfLines={1}>📝 {asset.description}</Text>:null}
          </View>
          <View style={s.assetVals}>
            <Text style={s.assetValMain}>{fmt(currentValue)}</Text>
            <Text style={s.assetValUnit}>تومان</Text>
            {usdRate > 0 && <Text style={s.assetValUsd}>≈ {fmtUSD(currentValue/usdRate)}</Text>}
            {profitLoss && (
              <View style={[s.profitBadge, isProfit?s.profitBadgeG:s.profitBadgeR]}>
                <Text style={[s.profitBadgeT, isProfit?s.profitTG:s.profitTR]}>
                  {isProfit?'▲':'▼'} {Math.abs(profitLoss.profitPercent).toFixed(1)}%
                </Text>
              </View>
            )}
            {profitLoss && (
              <Text style={[s.profitAmt, isProfit?s.positive:s.negative]}>
                {isProfit?'+':'-'}{fmt(Math.abs(profitLoss.profit))}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.6}>
        <Text style={s.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// --- Price Card ---
const PriceCard = React.memo(({ label, priceKey, value, onUpdate }) => (
  <View style={s.priceCard}>
    <Text style={s.priceCardLabel}>{label}</Text>
    <TextInput style={s.priceCardInput} keyboardType="numeric" value={value?.toString()||'0'}
      onChangeText={t=>onUpdate(priceKey,t)} placeholder="0" placeholderTextColor="#ccc" />
  </View>
));

// --- Category Summary ---
const CategorySummary = React.memo(({ assets, getCurrentPrice, usdRate }) => {
  const categories = useMemo(() => {
    const cats = {};
    assets.forEach(a => {
      const isFixed = ['حساب بانکی','پول نقد','سایر'].includes(a.type);
      const price = getCurrentPrice(a);
      const val = isFixed ? (a.buyPriceTotal||0) : (price ? price*a.quantity : a.buyPriceTotal||0);
      if (!cats[a.type]) cats[a.type] = { count: 0, value: 0 };
      cats[a.type].count++;
      cats[a.type].value += val;
    });
    return Object.entries(cats).sort((a,b)=>b[1].value-a[1].value);
  }, [assets, getCurrentPrice]);

  if (categories.length === 0) return null;

  return (
    <View style={s.catSummary}>
      <Text style={s.catSummaryTitle}>📂 خلاصه دسته‌ها</Text>
      <View style={s.catGrid}>
        {categories.map(([type, data]) => (
          <View key={type} style={[s.catCard, { borderLeftColor: gc(type) }]}>
            <Text style={s.catCardIcon}>{gi(type)}</Text>
            <Text style={s.catCardType}>{type}</Text>
            <Text style={s.catCardValue}>{fmtCompact(data.value)}</Text>
            <Text style={s.catCardCount}>{data.count} مورد</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

// ==================== MAIN APP ====================
export default function App() {
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalBuyPrice, setTotalBuyPrice] = useState(0);
  const [monthlyChange, setMonthlyChange] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('assets');
  const scrollViewRef = useRef(null);

  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [assetModalMode, setAssetModalMode] = useState('add');
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedAssetType, setSelectedAssetType] = useState('حساب بانکی');
  const [formData, setFormData] = useState({ quantity:1, ownership:'personal', buyDateJalaali:getTodayJalaali() });
  const [formDirty, setFormDirty] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  const [manualPrices, setManualPrices] = useState({...DEFAULT_PRICES});
  const [exchangeRates, setExchangeRates] = useState({});
  const [snapshots, setSnapshots] = useState([]);
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [showOwnershipChart, setShowOwnershipChart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('value_desc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const [isVpnActive, setIsVpnActive] = useState(false);
  const [vpnStatusText, setVpnStatusText] = useState('...');
  const [isLoading, setIsLoading] = useState(true);
  const [isPriceUpdating, setIsPriceUpdating] = useState(false);

  const headerFade = useRef(new Animated.Value(0)).current;

  // --- Back Handler ---
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (assetModalVisible) {
        if (formDirty) {
          Alert.alert('تغییرات ذخیره نشده', 'آیا می‌خواهید بدون ذخیره خارج شوید؟', [
            { text: 'ادامه ویرایش', style: 'cancel' },
            { text: 'خروج', style: 'destructive', onPress: () => { setAssetModalVisible(false); setFormDirty(false); } },
          ]);
        } else {
          setAssetModalVisible(false);
        }
        return true;
      }
      if (priceModalVisible) { setPriceModalVisible(false); return true; }
      if (showSortModal) { setShowSortModal(false); return true; }
      return false;
    });
    return () => handler.remove();
  }, [assetModalVisible, priceModalVisible, showSortModal, formDirty]);

  // --- Core Functions ---
  const getCurrentPrice = useCallback((asset) => {
    const { type, detail } = asset;
    if (type === 'ارز') {
      const dp = manualPrices[detail];
      if (dp && dp > 0) return dp;
      if (manualPrices.USD > 0 && exchangeRates[detail]) return manualPrices.USD / exchangeRates[detail];
      return null;
    }
    if (type === 'سکه') {
      return {'سکه امامی':manualPrices.COIN_EMAMI,'بهار آزادی':manualPrices.COIN_BAHAR,
        'نیم سکه':manualPrices.COIN_NIM,'ربع سکه':manualPrices.COIN_ROB,'سکه گرمی':manualPrices.COIN_GERAMI}[detail] || null;
    }
    if (type === 'طلا') {
      if (detail === '18 عیار') return manualPrices.GOLD_18_PER_GRAM;
      if (detail === '24 عیار') return manualPrices.GOLD_24_PER_GRAM;
      return null;
    }
    if (['حساب بانکی','پول نقد','سایر'].includes(type)) return null;
    return null;
  }, [manualPrices, exchangeRates]);

  const getAssetValue = useCallback((asset) => {
    const isFixed = ['حساب بانکی','پول نقد','سایر'].includes(asset.type);
    if (isFixed) return asset.buyPriceTotal || 0;
    const price = getCurrentPrice(asset);
    return price ? price * asset.quantity : asset.buyPriceTotal || 0;
  }, [getCurrentPrice]);

  const getProfitLoss = useCallback((asset) => {
    if (['حساب بانکی','پول نقد','سایر'].includes(asset.type)) return null;
    const price = getCurrentPrice(asset);
    if (!price || !asset.buyPriceTotal) return null;
    const cv = price * asset.quantity;
    const profit = cv - asset.buyPriceTotal;
    return { profit, profitPercent: asset.buyPriceTotal > 0 ? (profit/asset.buyPriceTotal)*100 : 0 };
  }, [getCurrentPrice]);

  // --- Memos ---
  const totalValueInUSD = useMemo(() => manualPrices.USD > 0 ? totalValue/manualPrices.USD : null, [totalValue, manualPrices.USD]);
  
  const totalProfitLoss = useMemo(() => {
    let totalCurrent = 0, totalBuy = 0, count = 0;
    assets.forEach(a => {
      if (['حساب بانکی','پول نقد','سایر'].includes(a.type)) return;
      const pl = getProfitLoss(a);
      if (pl) { totalCurrent += getAssetValue(a); totalBuy += a.buyPriceTotal||0; count++; }
    });
    if (count === 0) return null;
    const profit = totalCurrent - totalBuy;
    return { profit, percent: totalBuy > 0 ? (profit/totalBuy)*100 : 0, count };
  }, [assets, getProfitLoss, getAssetValue]);

  const filteredAndSortedAssets = useMemo(() => {
    let result = [...assets];
    if (ownershipFilter !== 'all') result = result.filter(a => a.ownership === ownershipFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(a => [a.type,a.detail,a.description,a.ownership==='corporate'?'شرکتی':'شخصی',a.buyDateJalaali||''].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      switch(sortBy) {
        case 'value_desc': return getAssetValue(b) - getAssetValue(a);
        case 'value_asc': return getAssetValue(a) - getAssetValue(b);
        case 'date_desc': return (b.buyDate||'').localeCompare(a.buyDate||'');
        case 'date_asc': return (a.buyDate||'').localeCompare(b.buyDate||'');
        case 'profit_desc': return (getProfitLoss(b)?.profit||0) - (getProfitLoss(a)?.profit||0);
        case 'profit_asc': return (getProfitLoss(a)?.profit||0) - (getProfitLoss(b)?.profit||0);
        case 'name_asc': return (a.detail||'').localeCompare(b.detail||'');
        default: return 0;
      }
    });
    return result;
  }, [assets, ownershipFilter, searchQuery, sortBy, getAssetValue, getProfitLoss]);

  const ownershipStats = useMemo(() => {
    let pV=0,cV=0,pC=0,cC=0;
    assets.forEach(a => {
      const v = getAssetValue(a);
      if(a.ownership==='corporate'){cV+=v;cC++;}else{pV+=v;pC++;}
    });
    const t = pV+cV;
    return {
      personal:{value:pV,percent:t>0?(pV/t)*100:0,count:pC},
      corporate:{value:cV,percent:t>0?(cV/t)*100:0,count:cC},
      total:t
    };
  }, [assets, getAssetValue]);

  const portfolioData = useMemo(() => {
    const m = {};
    let t = 0;
    assets.forEach(a => {
      const v = getAssetValue(a);
      t += v;
      const k = `${a.type}_${a.detail}`;
      if(m[k]){m[k].value+=v;m[k].quantity+=a.quantity;}
      else m[k]={type:a.type,detail:a.detail,value:v,quantity:a.quantity};
    });
    const portfolio = Object.values(m).map(i=>({...i,percent:t>0?(i.value/t)*100:0})).sort((a,b)=>b.value-a.value);
    return { portfolio, total: t };
  }, [assets, getAssetValue]);

  // --- API ---
  const fetchOnlinePrices = useCallback(async (showAlert=true) => {
    try {
      setIsPriceUpdating(true);
      const r = await fetch(`https://raw.githubusercontent.com/nvdtairbus-ctrl/AssetManager/main/prices.json?t=${Date.now()}`,
        {cache:'no-cache',headers:{'Cache-Control':'no-cache,no-store,must-revalidate','Pragma':'no-cache','Expires':'0'}});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if(!data?.usd) throw new Error('داده ناقص');
      const np = {
        ...DEFAULT_PRICES,USD:data.usd,EUR:data.eur||0,GBP:data.gbp||0,CHF:data.chf||0,
        CAD:data.cad||0,AUD:data.aud||0,SEK:data.sek||0,NOK:data.nok||0,RUB:data.rub||0,THB:data.thb||0,
        SGD:data.sgd||0,HKD:data.hkd||0,AZN:data.azn||0,AMD:data.amd||0,DKK:data.dkk||0,AED:data.aed||0,
        JPY:data.jpy||0,TRY:data.try||0,CNY:data.cny||0,SAR:data.sar||0,INR:data.inr||0,MYR:data.myr||0,
        AFN:data.afn||0,KWD:data.kwd||0,IQD:data.iqd||0,BHD:data.bhd||0,OMR:data.omr||0,QAR:data.qar||0,
        GOLD_18_PER_GRAM:data.gold||0,
        GOLD_24_PER_GRAM:data.gold?Math.round(data.gold*(24/18)):0,
        COIN_EMAMI:data.emami_coin||0,COIN_NIM:data.nim_coin||0,COIN_ROB:data.rob_coin||0,
        COIN_GERAMI:data.gold?Math.round(data.gold/4.5):0,
        COIN_BAHAR:data.emami_coin?Math.round(data.emami_coin*0.95):0,
      };
      setManualPrices(np);
      await AsyncStorage.setItem('manualPrices',JSON.stringify(np));
      setIsOnline(true);
      const now = getJalaaliDate() + ' ' + new Date().toLocaleTimeString('fa-IR');
      setLastPriceUpdate(now);
      await AsyncStorage.setItem('lastPriceUpdate', now);
      if(showAlert && data.last_update) {
        const {date,time} = getIranTime(new Date(data.last_update));
        Alert.alert('✅ بروزرسانی موفق',`📅 ${date}\n⏰ ${time}\n💵 دلار: ${np.USD.toLocaleString()} ت`);
      }
      return np;
    } catch(e) {
      setIsOnline(false);
      if(showAlert) Alert.alert('⚠️ خطا',`${e.message}\nاینترنت را بررسی کنید.`);
      return null;
    } finally { setIsPriceUpdating(false); }
  }, []);

  const fetchExchangeRates = useCallback(async () => {
    try {
      const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if(!data?.rates) throw new Error('ناقص');
      const fr = {};
      SUPPORTED_CURRENCIES.forEach(c => { if(data.rates[c]) fr[c]=data.rates[c]; });
      setExchangeRates(fr);
      await AsyncStorage.setItem('exchangeRates',JSON.stringify(fr));
      const now = getJalaaliDate()+' '+new Date().toLocaleTimeString('fa-IR');
      await AsyncStorage.setItem('lastUpdateTime',now);
      setLastUpdateTime(now);
      setIsOnline(true);
    } catch(e) { setIsOnline(false); }
  }, []);

  // --- Data Management ---
  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sa,sp,sr,ss,su,spu] = await Promise.all([
        AsyncStorage.getItem('assets'),AsyncStorage.getItem('manualPrices'),
        AsyncStorage.getItem('exchangeRates'),AsyncStorage.getItem('snapshots'),
        AsyncStorage.getItem('lastUpdateTime'),AsyncStorage.getItem('lastPriceUpdate'),
      ]);
      if(sa) {
        try {
          const parsed = JSON.parse(sa);
          const migrated = parsed.map(migrateAsset);
          setAssets(migrated);
          if(parsed.some(a=>(a._dataVersion||1)<DATA_VERSION))
            await AsyncStorage.setItem('assets',JSON.stringify(migrated));
        } catch(e) {
          await AsyncStorage.setItem('assets_backup',sa);
          setAssets([]);
        }
      }
      if(sp) try{setManualPrices(JSON.parse(sp));}catch(e){}
      if(sr) try{setExchangeRates(JSON.parse(sr));}catch(e){}
      if(ss) try{setSnapshots(JSON.parse(ss));}catch(e){}
      if(su) setLastUpdateTime(su);
      if(spu) setLastPriceUpdate(spu);
    } catch(e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  const calculateTotalValue = useCallback(() => {
    let total=0, totalBuy=0;
    assets.forEach(a => { total += getAssetValue(a); totalBuy += a.buyPriceTotal||0; });
    setTotalValue(total);
    setTotalBuyPrice(totalBuy);
    const today = new Date().toISOString().split('T')[0];
    setSnapshots(prev => {
      const ns = [...prev];
      const ei = ns.findIndex(x=>x.date===today);
      if(ei>=0) ns[ei].value=total; else ns.push({date:today,value:total});
      ns.sort((a,b)=>a.date.localeCompare(b.date));
      const last90 = ns.slice(-90);
      AsyncStorage.setItem('snapshots',JSON.stringify(last90)).catch(()=>{});
      if(last90.length>=2) {
        const ago = new Date(); ago.setDate(ago.getDate()-30);
        const agoStr = ago.toISOString().split('T')[0];
        let closest=null, minD=Infinity;
        last90.forEach(x=>{if(x.date<=agoStr){const d=Math.abs(new Date(agoStr)-new Date(x.date));if(d<minD){minD=d;closest=x;}}});
        if(closest?.value>0) setMonthlyChange(((total-closest.value)/closest.value)*100);
        else setMonthlyChange(null);
      }
      return last90;
    });
  }, [assets, getAssetValue]);

  const saveAsset = useCallback(async (asset) => {
    const errors = validateAsset(asset);
    if(errors.length>0) { Alert.alert('⚠️ خطا',errors.join('\n')); return false; }
    const fq = ['حساب بانکی','پول نقد'].includes(asset.type) ? 1 : (asset.quantity||1);
    const full = {
      ...asset, ownership:asset.ownership||'personal', quantity:fq, buyPriceTotal:asset.buyPriceTotal||0,
      buyDate: asset.buyDateJalaali ? jalaaliToGregorian(asset.buyDateJalaali) : new Date().toISOString().split('T')[0],
      buyDateJalaali: asset.buyDateJalaali||getTodayJalaali(), _dataVersion:DATA_VERSION,
    };
    let na;
    if(assetModalMode==='edit'&&selectedAsset) na=assets.map(a=>a.id===selectedAsset.id?{...full,id:selectedAsset.id}:a);
    else na=[...assets,{...full,id:uid()}];
    setAssets(na);
    await AsyncStorage.setItem('assets',JSON.stringify(na));
    setAssetModalVisible(false); setSelectedAsset(null); setFormDirty(false);
    setFormData({quantity:1,ownership:'personal',buyDateJalaali:getTodayJalaali()});
    Alert.alert(assetModalMode==='edit'?'✅ ویرایش شد':'✅ ثبت شد',
      `"${full.detail||full.type}" با موفقیت ${assetModalMode==='edit'?'ویرایش':'ثبت'} شد.`);
    return true;
  }, [assets, selectedAsset, assetModalMode]);

  const deleteAsset = useCallback((id,name) => {
    Alert.alert('🗑️ حذف',`"${name||'دارایی'}" حذف شود؟`,[
      {text:'انصراف',style:'cancel'},
      {text:'حذف',style:'destructive',onPress:async()=>{
        const na=assets.filter(a=>a.id!==id);
        setAssets(na); await AsyncStorage.setItem('assets',JSON.stringify(na));
      }},
    ]);
  }, [assets]);

  const updateManualPrice = useCallback((key,value) => {
    const n = Number(String(value).replace(/,/g,''));
    if(isNaN(n)||n<0)return;
    setManualPrices(prev=>{const np={...prev,[key]:n};AsyncStorage.setItem('manualPrices',JSON.stringify(np)).catch(()=>{});return np;});
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchExchangeRates(),fetchOnlinePrices(false)]);
    setRefreshing(false);
  }, [fetchExchangeRates, fetchOnlinePrices]);

  const exportData = useCallback(async () => {
    try {
      const data = {
        version: APP_VERSION, exportDate: getTodayJalaali(), assets,
        totalValue, manualPrices, snapshots: snapshots.slice(-30),
      };
      const text = `📊 گزارش دارایی‌ها\n📅 ${getTodayJalaali()}\n\n` +
        `💰 ارزش کل: ${fmt(totalValue)} تومان\n` +
        (manualPrices.USD>0?`💵 معادل: ${fmtUSD(totalValue/manualPrices.USD)}\n`:'') +
        `📦 تعداد: ${assets.length} قلم\n\n` +
        `👤 شخصی: ${fmt(ownershipStats.personal.value)} تومان (${ownershipStats.personal.percent.toFixed(1)}%)\n` +
        `🏢 شرکتی: ${fmt(ownershipStats.corporate.value)} تومان (${ownershipStats.corporate.percent.toFixed(1)}%)\n\n` +
        (totalProfitLoss ? `${totalProfitLoss.profit>=0?'📈 سود':'📉 زیان'} کل: ${fmt(Math.abs(totalProfitLoss.profit))} تومان (${Math.abs(totalProfitLoss.percent).toFixed(1)}%)\n\n` : '') +
        `--- جزئیات ---\n` +
        assets.map((a,i) => `${i+1}. ${gi(a.type)} ${a.detail||a.type} — ${fmt(getAssetValue(a))} ت`).join('\n');
      
      await Share.share({ message: text, title: 'گزارش دارایی‌ها' });
    } catch(e) { console.error(e); }
  }, [assets, totalValue, manualPrices, ownershipStats, totalProfitLoss, getAssetValue, snapshots]);

  const backupData = useCallback(async () => {
    try {
      const data = JSON.stringify({ v:APP_VERSION, d:getTodayJalaali(), a:assets, p:manualPrices, s:snapshots });
      await Share.share({ message: data, title: 'پشتیبان دارایی‌ها' });
    } catch(e) { Alert.alert('خطا','خطا در ایجاد پشتیبان'); }
  }, [assets, manualPrices, snapshots]);

  const openAddModal = useCallback(() => {
    setAssetModalMode('add'); setSelectedAsset(null);
    setSelectedAssetType('حساب بانکی');
    setFormData({quantity:1,ownership:'personal',buyDateJalaali:getTodayJalaali()});
    setFormDirty(false); setPickerKey(prev=>prev+1);
    setAssetModalVisible(true);
  }, []);

  const openEditModal = useCallback((asset) => {
    setAssetModalMode('edit'); setSelectedAsset(asset);
    setSelectedAssetType(asset.type);
    setFormData({
      detail:asset.detail, quantity:asset.quantity, buyPriceTotal:asset.buyPriceTotal,
      buyDateJalaali:asset.buyDateJalaali||(asset.buyDate?gregorianToJalaali(asset.buyDate):getTodayJalaali()),
      description:asset.description, ownership:asset.ownership||'personal',
    });
    setFormDirty(false); setPickerKey(prev=>prev+1);
    setAssetModalVisible(true);
  }, []);

  const closeAssetModal = useCallback(() => {
    if(formDirty) {
      Alert.alert('تغییرات ذخیره نشده','بدون ذخیره خارج شوید؟',[
        {text:'ادامه ویرایش',style:'cancel'},
        {text:'خروج',style:'destructive',onPress:()=>{setAssetModalVisible(false);setFormDirty(false);}},
      ]);
    } else { setAssetModalVisible(false); }
  }, [formDirty]);

  const updateForm = useCallback((key,value) => {
    setFormData(prev=>({...prev,[key]:value}));
    setFormDirty(true);
  }, []);

  // --- Effects ---
  useEffect(() => {
    (async()=>{try{if(Platform.OS!=='web'&&ExpoVpnChecker){const r=await ExpoVpnChecker.checkVpn();setIsVpnActive(r);setVpnStatusText(r?'✅ VPN':'⚠️ VPN غیرفعال');}else setVpnStatusText('—');}catch(e){setVpnStatusText('❌');}})();
  }, []);

  useEffect(() => {
    let mounted=true;
    (async()=>{
      await loadAllData();
      if(!mounted)return; await fetchExchangeRates();
      if(!mounted)return; await fetchOnlinePrices(false);
    })();
    const iv=setInterval(()=>{if(mounted){fetchExchangeRates();fetchOnlinePrices(false);}},21600000);
    return()=>{mounted=false;clearInterval(iv);};
  }, []);

  useEffect(() => { if(!isLoading) calculateTotalValue(); }, [assets, manualPrices, exchangeRates, isLoading]);

  useEffect(() => {
    Animated.timing(headerFade, {toValue:showStickyHeader?1:0,duration:200,useNativeDriver:true}).start();
  }, [showStickyHeader]);

  // --- Navigation ---
  const handleScroll = useCallback((e) => {
    const p = Math.round(e.nativeEvent.contentOffset.x/width);
    const t = p===0?'assets':'portfolio';
    if(t!==activeTab) setActiveTab(t);
  }, [activeTab]);

  const scrollToPage = useCallback((p) => scrollViewRef.current?.scrollTo({x:p*width,animated:true}), []);

  const handleAssetsScroll = useCallback((e) => {
    setShowStickyHeader(e.nativeEvent.contentOffset.y > 300);
  }, []);

  // --- Form Render ---
  const renderFormField = (label,placeholder,key,kb='default',isNum=false) => (
    <View key={key}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholder={placeholder} placeholderTextColor="#bbb"
        keyboardType={kb} value={formData[key]!=null?String(formData[key]):''}
        onChangeText={t=>{
          if(isNum){const n=key==='quantity'?parseFloat(t)||0:parseInt(t.replace(/,/g,''))||0;updateForm(key,n);}
          else updateForm(key,t);
        }} />
    </View>
  );

  const renderAssetForm = () => {
    switch(selectedAssetType) {
      case 'حساب بانکی': return <>{renderFormField('🏦 نام بانک','مثال: ملت','detail')}{renderFormField('💰 موجودی (تومان)','50000000','buyPriceTotal','numeric',true)}</>;
      case 'پول نقد': return <>{renderFormField('💵 منبع','مثال: صندوق منزل','detail')}{renderFormField('💰 میزان (تومان)','25000000','buyPriceTotal','numeric',true)}</>;
      case 'ارز': return (
        <>
          <Text style={s.fieldLabel}>💱 نوع ارز</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{marginBottom:8}}>
            {SUPPORTED_CURRENCIES.map(c=>(
              <TouchableOpacity key={c} style={[s.currChip,formData.detail===c&&s.currChipActive]} onPress={()=>updateForm('detail',c)}>
                <Text style={s.currChipFlag}>{gf(c)}</Text>
                <Text style={[s.currChipText,formData.detail===c&&s.currChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {formData.detail && <Text style={s.selectedCurr}>{gf(formData.detail)} {gn(formData.detail)}{manualPrices[formData.detail]>0?` — ${fmt(manualPrices[formData.detail])} ت`:''}</Text>}
          {renderFormField('📊 مقدار','500','quantity','numeric',true)}
          {renderFormField('💰 قیمت کل خرید (تومان)','40000000','buyPriceTotal','numeric',true)}
        </>);
      case 'سکه': return (
        <>
          <Text style={s.fieldLabel}>🪙 نوع سکه</Text>
          <View style={s.chipWrap}>{COIN_TYPES.map(c=>(
            <TouchableOpacity key={c} style={[s.chip,formData.detail===c&&s.chipActive]} onPress={()=>updateForm('detail',c)}>
              <Text style={[s.chipText,formData.detail===c&&s.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}</View>
          {renderFormField('🔢 تعداد','2','quantity','numeric',true)}
          {renderFormField('💰 قیمت کل خرید (تومان)','70000000','buyPriceTotal','numeric',true)}
        </>);
      case 'طلا': return (
        <>
          <Text style={s.fieldLabel}>🥇 عیار</Text>
          <View style={s.chipWrap}>{['18 عیار','24 عیار'].map(k=>(
            <TouchableOpacity key={k} style={[s.chip,s.chipW,formData.detail===k&&s.chipActive]} onPress={()=>updateForm('detail',k)}>
              <Text style={[s.chipText,formData.detail===k&&s.chipTextActive]}>{k}</Text>
            </TouchableOpacity>
          ))}</View>
          {renderFormField('⚖️ وزن (گرم)','10.5','quantity','numeric',true)}
          {renderFormField('💰 قیمت کل خرید (تومان)','10000000','buyPriceTotal','numeric',true)}
        </>);
      case 'اوراق بهادار و سهام': return <>{renderFormField('📈 نماد','شستا','detail')}{renderFormField('📊 حجم','1000','quantity','numeric',true)}{renderFormField('💰 قیمت کل خرید (تومان)','5000000','buyPriceTotal','numeric',true)}</>;
      default: return <>{renderFormField('📦 نام دارایی','خودرو، ملک','detail')}{renderFormField('💰 ارزش (تومان)','500000000','buyPriceTotal','numeric',true)}</>;
    }
  };

  // --- Main Renders ---
  const renderAssetsContent = () => (
    <ScrollView onScroll={handleAssetsScroll} scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} tintColor="#3b82f6" />}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.title}>💼 مدیریت دارایی</Text>
            <Text style={s.subtitle}>{getJalaaliDate()} • {assets.length} دارایی • v{APP_VERSION}</Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={[s.hBtn,{backgroundColor:'#6c5ce7'}]} onPress={()=>setPriceModalVisible(true)}>
            <Text style={s.hBtnText}>⚙️ قیمت‌ها</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.hBtn,{backgroundColor:'#00b894'}]} onPress={onRefresh}>
            <Text style={s.hBtnText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.hBtn,{backgroundColor:'#0984e3'}]} onPress={exportData}>
            <Text style={s.hBtnText}>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.hBtn,{backgroundColor:'#e17055'}]} onPress={openAddModal}>
            <Text style={s.hBtnText}>➕ ثبت</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status */}
      <View style={s.statusRow}>
        <View style={s.statusItem}><View style={[s.statusDot,isOnline?s.on:s.off]}/><Text style={s.statusT}>{isOnline?'آنلاین':'آفلاین'}</Text></View>
        {isPriceUpdating && <View style={s.statusItem}><ActivityIndicator size="small" color="#3b82f6"/><Text style={s.statusT}>...</Text></View>}
        <Text style={s.statusTS}>{vpnStatusText}</Text>
        {lastPriceUpdate && <Text style={s.statusTS}>قیمت: {lastPriceUpdate}</Text>}
      </View>

      {/* Value Cards */}
      <View style={s.valCards}>
        <View style={s.mainCard}>
          <View style={s.mainCardGrad}>
            <Text style={s.mainCardTitle}>💰 ارزش کل دارایی‌ها</Text>
            <Text style={s.mainCardValue}>{fmt(totalValue)}</Text>
            <Text style={s.mainCardUnit}>تومان</Text>
            {totalValue>=1e9 && <Text style={s.mainCardCompact}>({fmtCompact(totalValue)})</Text>}
            <View style={s.usdSection}>
              <View style={s.usdLine}/>
              {totalValueInUSD!=null ? (
                <><Text style={s.usdLabel}>معادل دلاری</Text><Text style={s.usdVal}>{fmtUSD(totalValueInUSD)}</Text>
                <Text style={s.usdRate}>نرخ: {fmt(manualPrices.USD)} ت</Text></>
              ) : <Text style={s.usdNA}>⚠️ قیمت دلار تنظیم نشده</Text>}
            </View>
          </View>
        </View>

        <View style={s.miniCards}>
          <View style={s.miniCard}>
            <Text style={s.miniCardTitle}>📈 تغییر ۳۰ روزه</Text>
            <Text style={[s.miniCardVal,(monthlyChange??0)>=0?s.positive:s.negative]}>
              {monthlyChange!=null?`${monthlyChange>=0?'+':''}${monthlyChange.toFixed(1)}%`:'—'}
            </Text>
          </View>
          <View style={s.miniCard}>
            <Text style={s.miniCardTitle}>{totalProfitLoss?.profit>=0?'📈 سود':'📉 زیان'} کل</Text>
            <Text style={[s.miniCardVal,(totalProfitLoss?.profit??0)>=0?s.positive:s.negative]}>
              {totalProfitLoss ? `${fmt(Math.abs(totalProfitLoss.profit))} ت` : '—'}
            </Text>
            {totalProfitLoss && <Text style={s.miniCardSub}>{Math.abs(totalProfitLoss.percent).toFixed(1)}% ({totalProfitLoss.count} قلم)</Text>}
          </View>
        </View>
      </View>

      {/* Ownership */}
      <View style={s.ownerCard}>
        <View style={s.ownerCardH}>
          <Text style={s.ownerCardTitle}>📊 تفکیک مالکیت</Text>
          <TouchableOpacity onPress={()=>setShowOwnershipChart(!showOwnershipChart)}>
            <Text style={s.toggleT}>{showOwnershipChart?'📋 لیست':'📊 نمودار'}</Text>
          </TouchableOpacity>
        </View>
        {showOwnershipChart ? (
          <View>
            <View style={s.ownerBar}>
              {ownershipStats.personal.percent>0&&<View style={[s.ownerBarSeg,{width:`${ownershipStats.personal.percent}%`,backgroundColor:'#3b82f6',borderTopLeftRadius:10,borderBottomLeftRadius:10,borderTopRightRadius:ownershipStats.corporate.percent===0?10:0,borderBottomRightRadius:ownershipStats.corporate.percent===0?10:0}]}>{ownershipStats.personal.percent>15&&<Text style={s.barSegT}>{ownershipStats.personal.percent.toFixed(0)}%</Text>}</View>}
              {ownershipStats.corporate.percent>0&&<View style={[s.ownerBarSeg,{width:`${ownershipStats.corporate.percent}%`,backgroundColor:'#f59e0b',borderTopRightRadius:10,borderBottomRightRadius:10,borderTopLeftRadius:ownershipStats.personal.percent===0?10:0,borderBottomLeftRadius:ownershipStats.personal.percent===0?10:0}]}>{ownershipStats.corporate.percent>15&&<Text style={s.barSegT}>{ownershipStats.corporate.percent.toFixed(0)}%</Text>}</View>}
            </View>
            <View style={s.legend}>
              <View style={s.legendI}><View style={[s.legendD,{backgroundColor:'#3b82f6'}]}/><Text style={s.legendT}>شخصی {ownershipStats.personal.percent.toFixed(1)}%</Text></View>
              <View style={s.legendI}><View style={[s.legendD,{backgroundColor:'#f59e0b'}]}/><Text style={s.legendT}>شرکتی {ownershipStats.corporate.percent.toFixed(1)}%</Text></View>
            </View>
          </View>
        ) : (
          <View>
            {[{k:'personal',i:'👤',l:'شخصی',c:'#3b82f6',d:ownershipStats.personal},{k:'corporate',i:'🏢',l:'شرکتی',c:'#f59e0b',d:ownershipStats.corporate}].map((x,idx)=>(
              <React.Fragment key={x.k}>
                {idx>0&&<View style={s.ownerDiv}/>}
                <View style={s.ownerDetailRow}>
                  <Text style={s.ownerDetailIcon}>{x.i}</Text>
                  <View style={{flex:1}}>
                    <Text style={s.ownerDetailLabel}>{x.l} ({x.d.count} قلم)</Text>
                    <Text style={[s.ownerDetailVal,{color:x.c}]}>{fmt(x.d.value)} تومان</Text>
                    {manualPrices.USD>0&&<Text style={s.ownerDetailUsd}>≈ {fmtUSD(x.d.value/manualPrices.USD)}</Text>}
                  </View>
                  <Text style={[s.ownerDetailPct,{color:x.c}]}>{x.d.percent.toFixed(1)}%</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      {/* Category Summary */}
      <CategorySummary assets={assets} getCurrentPrice={getCurrentPrice} usdRate={manualPrices.USD} />

      {/* Search & Filter & Sort */}
      <View style={s.searchSection}>
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput style={s.searchInput} placeholder="جستجو..." placeholderTextColor="#bbb"
            value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery.length>0 && <TouchableOpacity onPress={()=>setSearchQuery('')}><Text style={s.searchClear}>✕</Text></TouchableOpacity>}
        </View>
        <View style={s.filterSortRow}>
          <View style={s.filterChips}>
            {[{id:'all',l:'همه',c:'#3b82f6'},{id:'personal',l:'👤',c:'#3b82f6'},{id:'corporate',l:'🏢',c:'#f59e0b'}].map(f=>(
              <TouchableOpacity key={f.id} style={[s.filterChip,ownershipFilter===f.id&&[s.filterChipA,{backgroundColor:f.c}]]} onPress={()=>setOwnershipFilter(f.id)}>
                <Text style={[s.filterChipT,ownershipFilter===f.id&&s.filterChipTA]}>{f.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.sortBtn} onPress={()=>setShowSortModal(true)}>
            <Text style={s.sortBtnText}>⇅ مرتب‌سازی</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List Header */}
      <View style={s.listH}>
        <Text style={s.listTitle}>📋 {filteredAndSortedAssets.length} دارایی{searchQuery?` — "${searchQuery}"`:''}</Text>
        <Text style={s.listSortLabel}>{SORT_OPTIONS.find(x=>x.id===sortBy)?.label}</Text>
      </View>

      {/* List */}
      {filteredAndSortedAssets.length>0 ? filteredAndSortedAssets.map(a=>(
        <AssetItem key={a.id} asset={a} currentPrice={getCurrentPrice(a)} unitPrice={getCurrentPrice(a)}
          profitLoss={getProfitLoss(a)} usdRate={manualPrices.USD}
          onPress={()=>openEditModal(a)} onDelete={()=>deleteAsset(a.id,a.detail||a.type)} />
      )) : (
        <View style={s.empty}><Text style={s.emptyIcon}>{searchQuery?'🔍':'📭'}</Text>
          <Text style={s.emptyTitle}>{searchQuery?`"${searchQuery}" یافت نشد`:'دارایی یافت نشد'}</Text>
          <Text style={s.emptySub}>{searchQuery?'عبارت را تغییر دهید':ownershipFilter!=='all'?'فیلتر را تغییر دهید':'روی ➕ ثبت بزنید'}</Text>
        </View>
      )}
      <View style={{height:50}}/>
    </ScrollView>
  );

  const renderPortfolioContent = () => {
    const {portfolio,total} = portfolioData;
    return (
      <ScrollView style={{padding:16}}>
        {/* Ownership */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>📊 تفکیک مالکیت</Text>
          {[{k:'personal',i:'👤',l:'شخصی',c:'#3b82f6',d:ownershipStats.personal},{k:'corporate',i:'🏢',l:'شرکتی',c:'#f59e0b',d:ownershipStats.corporate}].map(x=>(
            <View key={x.k} style={{marginBottom:16}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                <Text style={s.pOwnerLabel}>{x.i} {x.l}</Text>
                <Text style={[s.pOwnerPct,{color:x.c}]}>{x.d.percent.toFixed(1)}%</Text>
              </View>
              <View style={s.pOwnerBar}><View style={[s.pOwnerBarFill,{width:`${x.d.percent}%`,backgroundColor:x.c}]}/></View>
              <View style={{flexDirection:'row',justifyContent:'space-between'}}>
                <Text style={s.pOwnerVal}>{fmt(x.d.value)} تومان</Text>
                {manualPrices.USD>0&&<Text style={s.pOwnerUsd}>≈ {fmtUSD(x.d.value/manualPrices.USD)}</Text>}
              </View>
            </View>
          ))}
          <View style={s.pTotalRow}>
            <Text style={s.pTotalLabel}>مجموع:</Text>
            <View><Text style={s.pTotalVal}>{fmt(ownershipStats.total)} تومان</Text>
              {manualPrices.USD>0&&<Text style={s.pTotalUsd}>≈ {fmtUSD(ownershipStats.total/manualPrices.USD)}</Text>}</View>
          </View>
        </View>

        {/* Portfolio */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>📈 تحلیل پرتفوی</Text>
          {portfolio.length>0 ? (<>
            <View style={s.table}>
              <View style={s.tHeader}>
                <Text style={[s.tCell,s.tHCell,{flex:2.5}]}>دارایی</Text>
                <Text style={[s.tCell,s.tHCell,{flex:1.2}]}>مقدار</Text>
                <Text style={[s.tCell,s.tHCell,{flex:1}]}>سهم</Text>
                <Text style={[s.tCell,s.tHCell,{flex:2}]}>ارزش</Text>
              </View>
              {portfolio.map((item,i)=>{
                let q='—';
                if(item.type==='ارز')q=`${item.quantity} واحد`;
                else if(item.type==='سکه')q=`${item.quantity} عدد`;
                else if(item.type==='طلا')q=`${item.quantity} گرم`;
                else if(item.type==='اوراق بهادار و سهام')q=`${item.quantity} سهم`;
                return(
                  <View key={i} style={[s.tRow,i%2===0?s.tRowE:s.tRowO]}>
                    <Text style={[s.tCell,{flex:2.5,fontWeight:'600',color:gc(item.type)}]}>{gi(item.type)} {item.detail}</Text>
                    <Text style={[s.tCell,{flex:1.2,fontSize:11}]}>{q}</Text>
                    <Text style={[s.tCell,{flex:1,fontWeight:'bold',color:gc(item.type)}]}>{item.percent.toFixed(1)}%</Text>
                    <View style={{flex:2}}><Text style={[s.tCell,{fontSize:12}]}>{fmt(item.value)}</Text>
                      {manualPrices.USD>0&&<Text style={[s.tCell,{fontSize:10,color:'#999'}]}>{fmtUSD(item.value/manualPrices.USD)}</Text>}</View>
                  </View>);
              })}
            </View>
            <View style={{marginTop:16}}>
              <Text style={s.chartTitle}>📊 نمودار توزیع</Text>
              {portfolio.map((item,i)=>(
                <View key={i} style={{marginBottom:14}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                    <Text style={s.chartLabel}>{gi(item.type)} {item.detail}</Text>
                    <Text style={[s.chartPct,{color:gc(item.type)}]}>{item.percent.toFixed(1)}%</Text>
                  </View>
                  <View style={s.chartBar}><View style={[s.chartBarFill,{width:`${Math.max(item.percent,1)}%`,backgroundColor:gc(item.type)}]}/></View>
                  <View style={{flexDirection:'row',justifyContent:'space-between'}}>
                    <Text style={s.chartVal}>{fmt(item.value)} تومان</Text>
                    {manualPrices.USD>0&&<Text style={s.chartUsd}>{fmtUSD(item.value/manualPrices.USD)}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </>) : <View style={s.empty}><Text style={s.emptyIcon}>📊</Text><Text style={s.emptyTitle}>پرتفوی خالی</Text></View>}
        </View>

        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>💡 نکات</Text>
          {['📌 تنوع: دارایی‌ها را پخش کنید','📌 بروزرسانی: هر هفته قیمت‌ها را چک کنید','📌 ریسک: بیش از ۳۰٪ در یک دارایی نگذارید','📌 سود مرکب: سود را سرمایه‌گذاری مجدد کنید'].map((t,i)=><Text key={i} style={s.tipT}>{t}</Text>)}
        </View>
        <View style={{height:50}}/>
      </ScrollView>
    );
  };

  if(isLoading) return (
    <SafeAreaView style={s.loadingScreen}><StatusBar barStyle="dark-content" backgroundColor="#f8f9fa"/>
      <Text style={{fontSize:48}}>💼</Text><ActivityIndicator size="large" color="#3b82f6" style={{marginTop:16}}/>
      <Text style={s.loadingT}>در حال بارگذاری...</Text></SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content" backgroundColor="#f0f2f5"/>
      
      {/* Sticky Header */}
      <Animated.View style={[s.stickyH,{opacity:headerFade,transform:[{translateY:headerFade.interpolate({inputRange:[0,1],outputRange:[-50,0]})}]}]} pointerEvents={showStickyHeader&&activeTab==='assets'?'auto':'none'}>
        <Text style={s.stickyHText}>💰 {fmtCompact(totalValue)} ت</Text>
        {totalValueInUSD!=null&&<Text style={s.stickyHUsd}>≈ {fmtUSD(totalValueInUSD)}</Text>}
        {totalProfitLoss&&<Text style={[s.stickyHProfit,totalProfitLoss.profit>=0?s.positive:s.negative]}>
          {totalProfitLoss.profit>=0?'▲':'▼'}{Math.abs(totalProfitLoss.percent).toFixed(1)}%</Text>}
      </Animated.View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {[{id:'assets',l:'📋 دارایی‌ها',p:0},{id:'portfolio',l:'📊 ترکیب',p:1}].map(tab=>(
          <TouchableOpacity key={tab.id} style={[s.tab,activeTab===tab.id&&s.tabActive]} onPress={()=>{setActiveTab(tab.id);scrollToPage(tab.p);}}>
            <Text style={[s.tabText,activeTab===tab.id&&s.tabTextActive]}>{tab.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pages */}
      <ScrollView ref={scrollViewRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScroll={handleScroll} scrollEventThrottle={16} nestedScrollEnabled>
        <View style={{width}}>{renderAssetsContent()}</View>
        <View style={{width}}>{renderPortfolioContent()}</View>
      </ScrollView>

      {/* Asset Modal */}
      <Modal animationType="slide" transparent visible={assetModalVisible} onRequestClose={closeAssetModal}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalH}>
              <Text style={s.modalTitle}>{assetModalMode==='edit'?'✏️ ویرایش':'✨ افزودن دارایی'}</Text>
              <TouchableOpacity onPress={closeAssetModal} style={s.modalCloseBtn}><Text style={s.modalCloseT}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>📂 نوع دارایی</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
                {ASSET_TYPES.map(type=>(
                  <TouchableOpacity key={type} style={[s.typeChip,selectedAssetType===type&&[s.typeChipA,{backgroundColor:gc(type)}]]}
                    onPress={()=>{setSelectedAssetType(type);setFormDirty(true);}}>
                    <Text style={s.typeChipIcon}>{gi(type)}</Text>
                    <Text style={[s.typeChipText,selectedAssetType===type&&s.typeChipTextA]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={s.formDiv}/>
              {renderAssetForm()}
              
              {/* Ownership */}
              <View style={{marginTop:8}}>
                <Text style={s.fieldLabel}>🏷️ نوع مالکیت</Text>
                <View style={s.ownerOpts}>
                  {[{id:'personal',i:'👤',l:'شخصی',c:'#3b82f6'},{id:'corporate',i:'🏢',l:'شرکتی',c:'#f59e0b'}].map(o=>(
                    <TouchableOpacity key={o.id} style={[s.ownerOpt,formData.ownership===o.id&&[s.ownerOptA,{borderColor:o.c}]]}
                      onPress={()=>updateForm('ownership',o.id)}>
                      <Text style={s.ownerOptIcon}>{o.i}</Text>
                      <Text style={[s.ownerOptText,formData.ownership===o.id&&{color:o.c,fontWeight:'bold'}]}>{o.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={s.fieldLabel}>📅 تاریخ خرید (شمسی)</Text>
              <JalaaliDatePicker value={formData.buyDateJalaali||getTodayJalaali()}
                onChange={d=>updateForm('buyDateJalaali',d)} pickerKey={pickerKey} />

              <Text style={s.fieldLabel}>📝 توضیحات (اختیاری)</Text>
              <TextInput style={[s.input,s.textArea]} placeholder="توضیحات..." placeholderTextColor="#bbb"
                multiline numberOfLines={3} value={formData.description} onChangeText={t=>updateForm('description',t)} />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={closeAssetModal}><Text style={s.cancelBtnT}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={s.submitBtn} onPress={()=>saveAsset({
                  type:selectedAssetType, detail:formData.detail||'', quantity:formData.quantity||1,
                  buyPriceTotal:formData.buyPriceTotal||0, buyDateJalaali:formData.buyDateJalaali||getTodayJalaali(),
                  description:formData.description||'', ownership:formData.ownership||'personal',
                })}><Text style={s.submitBtnT}>{assetModalMode==='edit'?'✓ ذخیره':'✓ افزودن'}</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Price Modal */}
      <Modal animationType="slide" transparent visible={priceModalVisible} onRequestClose={()=>setPriceModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={s.modalOverlay}>
          <View style={[s.modalContent,{maxHeight:height*0.92}]}>
            <View style={s.modalH}>
              <View><Text style={s.modalTitle}>⚙️ تنظیم قیمت‌ها</Text><Text style={s.modalSub}>قیمت‌ها به تومان</Text></View>
              <TouchableOpacity onPress={()=>setPriceModalVisible(false)} style={s.modalCloseBtn}><Text style={s.modalCloseT}>✕</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.autoBtn,isPriceUpdating&&{backgroundColor:'#81c784'}]} onPress={()=>fetchOnlinePrices(true)} disabled={isPriceUpdating}>
              {isPriceUpdating?<View style={{flexDirection:'row',alignItems:'center'}}><ActivityIndicator size="small" color="#fff"/><Text style={s.autoBtnT}> دریافت...</Text></View>
                :<Text style={s.autoBtnT}>🔄 دریافت خودکار</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.autoBtn,{backgroundColor:'#6c5ce7',marginTop:-8}]} onPress={backupData}>
              <Text style={s.autoBtnT}>💾 پشتیبان‌گیری</Text>
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              <View style={s.priceSection}><Text style={s.priceSectionT}>💱 ارزهای اصلی</Text>
                <View style={s.priceGrid}>{MAIN_CURRENCIES.map(c=><PriceCard key={c} label={`${gf(c)} ${gn(c)} (${c})`} priceKey={c} value={manualPrices[c]} onUpdate={updateManualPrice}/>)}</View></View>
              <View style={s.priceSection}><Text style={s.priceSectionT}>🌍 سایر ارزها</Text>
                <View style={s.priceGrid}>{OTHER_CURRENCIES.map(c=><PriceCard key={c} label={`${gf(c)} ${gn(c)} (${c})`} priceKey={c} value={manualPrices[c]} onUpdate={updateManualPrice}/>)}</View></View>
              <View style={s.priceSection}><Text style={s.priceSectionT}>🥇 طلا و سکه</Text>
                <View style={s.priceGrid}>
                  {[{l:'🥇 طلای ۱۸ (گرم)',k:'GOLD_18_PER_GRAM'},{l:'🥇 طلای ۲۴ (گرم)',k:'GOLD_24_PER_GRAM'},
                    {l:'🪙 سکه امامی',k:'COIN_EMAMI'},{l:'🪙 بهار آزادی',k:'COIN_BAHAR'},
                    {l:'🪙 نیم سکه',k:'COIN_NIM'},{l:'🪙 ربع سکه',k:'COIN_ROB'},{l:'🪙 گرمی',k:'COIN_GERAMI'}
                  ].map(x=><PriceCard key={x.k} label={x.l} priceKey={x.k} value={manualPrices[x.k]} onUpdate={updateManualPrice}/>)}
                </View>
              </View>
              <TouchableOpacity style={s.priceSaveBtn} onPress={()=>setPriceModalVisible(false)}><Text style={s.priceSaveBtnT}>✓ ذخیره و بستن</Text></TouchableOpacity>
              <View style={{height:20}}/>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sort Modal */}
      <Modal animationType="fade" transparent visible={showSortModal} onRequestClose={()=>setShowSortModal(false)}>
        <TouchableOpacity style={s.sortModalOverlay} activeOpacity={1} onPress={()=>setShowSortModal(false)}>
          <View style={s.sortModalContent}>
            <Text style={s.sortModalTitle}>⇅ مرتب‌سازی بر اساس</Text>
            {SORT_OPTIONS.map(opt=>(
              <TouchableOpacity key={opt.id} style={[s.sortOption,sortBy===opt.id&&s.sortOptionA]}
                onPress={()=>{setSortBy(opt.id);setShowSortModal(false);}}>
                <Text style={[s.sortOptionT,sortBy===opt.id&&s.sortOptionTA]}>{sortBy===opt.id?'✓ ':''}{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ==================== STYLES ====================
const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f0f2f5'},
  loadingScreen:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#f8f9fa'},
  loadingT:{marginTop:12,fontSize:16,color:'#666'},

  stickyH:{position:'absolute',top:Platform.OS==='android'?(StatusBar.currentHeight||0)+48:48,left:0,right:0,zIndex:100,backgroundColor:'#ffffffee',paddingVertical:10,paddingHorizontal:16,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:'#e8e8e8',elevation:6,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.1},
  stickyHText:{fontSize:15,fontWeight:'bold',color:'#1e293b'},
  stickyHUsd:{fontSize:13,color:'#3b82f6',fontWeight:'600'},
  stickyHProfit:{fontSize:12,fontWeight:'bold'},

  tabBar:{flexDirection:'row',backgroundColor:'#fff',paddingTop:Platform.OS==='android'?StatusBar.currentHeight||0:0,borderBottomWidth:1,borderBottomColor:'#e2e8f0',elevation:4,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.1},
  tab:{flex:1,paddingVertical:14,alignItems:'center',borderBottomWidth:3,borderBottomColor:'transparent'},
  tabActive:{borderBottomColor:'#3b82f6'},
  tabText:{fontSize:15,color:'#94a3b8',fontWeight:'500'},
  tabTextActive:{color:'#3b82f6',fontWeight:'bold'},

  header:{backgroundColor:'#fff',paddingHorizontal:20,paddingTop:16,paddingBottom:16,borderBottomWidth:1,borderBottomColor:'#e2e8f0'},
  headerTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},
  title:{fontSize:22,fontWeight:'800',color:'#1e293b'},
  subtitle:{fontSize:12,color:'#94a3b8',marginTop:4},
  headerActions:{flexDirection:'row',justifyContent:'center',gap:8,flexWrap:'wrap'},
  hBtn:{paddingHorizontal:14,paddingVertical:10,borderRadius:25,alignItems:'center'},
  hBtnText:{color:'#fff',fontSize:13,fontWeight:'700'},

  statusRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:8,paddingHorizontal:16,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e2e8f0',gap:10,flexWrap:'wrap'},
  statusItem:{flexDirection:'row',alignItems:'center',gap:4},
  statusDot:{width:8,height:8,borderRadius:4},
  on:{backgroundColor:'#10b981'},off:{backgroundColor:'#ef4444'},
  statusT:{fontSize:11,color:'#64748b'},
  statusTS:{fontSize:10,color:'#94a3b8'},

  valCards:{padding:16,gap:12},
  mainCard:{borderRadius:24,overflow:'hidden',shadowColor:'#000',shadowOffset:{width:0,height:6},shadowOpacity:0.1,shadowRadius:16,elevation:6},
  mainCardGrad:{backgroundColor:'#fff',padding:28,alignItems:'center',borderRadius:24,borderWidth:1,borderColor:'#e2e8f0'},
  mainCardTitle:{fontSize:14,color:'#94a3b8',fontWeight:'600',marginBottom:12},
  mainCardValue:{fontSize:34,fontWeight:'900',color:'#1e293b',letterSpacing:0.5},
  mainCardUnit:{fontSize:14,color:'#94a3b8',marginTop:2},
  mainCardCompact:{fontSize:13,color:'#94a3b8',marginTop:4},
  usdSection:{width:'100%',alignItems:'center',marginTop:18},
  usdLine:{width:'50%',height:1,backgroundColor:'#e2e8f0',marginBottom:14},
  usdLabel:{fontSize:12,color:'#94a3b8',marginBottom:4},
  usdVal:{fontSize:26,fontWeight:'bold',color:'#3b82f6'},
  usdRate:{fontSize:11,color:'#cbd5e1',marginTop:4},
  usdNA:{fontSize:12,color:'#f59e0b'},

  miniCards:{flexDirection:'row',gap:12},
  miniCard:{flex:1,backgroundColor:'#fff',borderRadius:16,padding:16,alignItems:'center',borderWidth:1,borderColor:'#e2e8f0'},
  miniCardTitle:{fontSize:11,color:'#94a3b8',marginBottom:8,textAlign:'center'},
  miniCardVal:{fontSize:18,fontWeight:'bold'},
  miniCardSub:{fontSize:10,color:'#94a3b8',marginTop:4},
  positive:{color:'#10b981'},negative:{color:'#ef4444'},

  ownerCard:{backgroundColor:'#fff',marginHorizontal:16,marginBottom:12,borderRadius:20,padding:18,borderWidth:1,borderColor:'#e2e8f0'},
  ownerCardH:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
  ownerCardTitle:{fontSize:15,fontWeight:'bold',color:'#1e293b'},
  toggleT:{fontSize:12,color:'#3b82f6',fontWeight:'600'},
  ownerBar:{flexDirection:'row',height:36,width:'100%',borderRadius:10,overflow:'hidden',backgroundColor:'#f1f5f9',marginBottom:14},
  ownerBarSeg:{height:36,justifyContent:'center',alignItems:'center'},
  barSegT:{color:'#fff',fontSize:12,fontWeight:'bold'},
  legend:{flexDirection:'row',justifyContent:'center',gap:24},
  legendI:{flexDirection:'row',alignItems:'center',gap:6},
  legendD:{width:12,height:12,borderRadius:6},
  legendT:{fontSize:13,color:'#64748b'},
  ownerDiv:{height:1,backgroundColor:'#f1f5f9',marginVertical:6},
  ownerDetailRow:{flexDirection:'row',alignItems:'center',paddingVertical:10},
  ownerDetailIcon:{fontSize:28,width:40},
  ownerDetailLabel:{fontSize:13,color:'#94a3b8'},
  ownerDetailVal:{fontSize:16,fontWeight:'bold',marginTop:2},
  ownerDetailUsd:{fontSize:12,color:'#94a3b8',marginTop:2},
  ownerDetailPct:{fontSize:18,fontWeight:'bold'},

  catSummary:{marginHorizontal:16,marginBottom:12},
  catSummaryTitle:{fontSize:15,fontWeight:'bold',color:'#1e293b',marginBottom:12},
  catGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  catCard:{flex:1,minWidth:(width-48)/2-4,backgroundColor:'#fff',borderRadius:14,padding:14,borderLeftWidth:4,borderWidth:1,borderColor:'#e2e8f0'},
  catCardIcon:{fontSize:24,marginBottom:4},
  catCardType:{fontSize:12,fontWeight:'600',color:'#475569'},
  catCardValue:{fontSize:14,fontWeight:'bold',color:'#1e293b',marginTop:4},
  catCardCount:{fontSize:11,color:'#94a3b8',marginTop:2},

  searchSection:{paddingHorizontal:16,marginBottom:8},
  searchBox:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderRadius:14,paddingHorizontal:14,marginBottom:10,borderWidth:1,borderColor:'#e2e8f0'},
  searchIcon:{fontSize:16,marginRight:8},
  searchInput:{flex:1,paddingVertical:12,fontSize:14,color:'#1e293b'},
  searchClear:{fontSize:16,color:'#94a3b8',fontWeight:'bold',padding:4},
  filterSortRow:{flexDirection:'row',alignItems:'center',gap:8},
  filterChips:{flexDirection:'row',flex:1,gap:6},
  filterChip:{flex:1,paddingVertical:8,borderRadius:20,backgroundColor:'#fff',alignItems:'center',borderWidth:1,borderColor:'#e2e8f0'},
  filterChipA:{borderColor:'transparent'},
  filterChipT:{fontSize:12,color:'#64748b',fontWeight:'500'},
  filterChipTA:{color:'#fff',fontWeight:'bold'},
  sortBtn:{paddingHorizontal:12,paddingVertical:8,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2e8f0'},
  sortBtnText:{fontSize:12,color:'#3b82f6',fontWeight:'600'},

  listH:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,paddingTop:12,paddingBottom:8},
  listTitle:{fontSize:16,fontWeight:'bold',color:'#1e293b',flex:1},
  listSortLabel:{fontSize:11,color:'#94a3b8',backgroundColor:'#f1f5f9',paddingHorizontal:10,paddingVertical:4,borderRadius:10},

  assetItemWrap:{marginHorizontal:16,marginBottom:10,position:'relative'},
  assetItem:{backgroundColor:'#fff',borderRadius:18,padding:16,borderWidth:1,borderColor:'#e2e8f0'},
  assetRow:{flexDirection:'row',alignItems:'center'},
  assetIcon:{width:50,height:50,borderRadius:14,justifyContent:'center',alignItems:'center',marginRight:12,position:'relative'},
  assetIconText:{fontSize:22},
  ownerBadge:{position:'absolute',bottom:-3,right:-3,width:18,height:18,borderRadius:9,backgroundColor:'#fff',justifyContent:'center',alignItems:'center',borderWidth:1.5},
  ownerBadgeText:{fontSize:9},
  assetInfo:{flex:1,marginRight:8},
  assetHeaderRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:2},
  assetType:{fontSize:13,fontWeight:'bold'},
  ownerTag:{paddingHorizontal:6,paddingVertical:1,borderRadius:8},
  persTag:{backgroundColor:'#eff6ff'},corpTag:{backgroundColor:'#fef3c7'},
  ownerTagText:{fontSize:9,fontWeight:'600'},
  persTagText:{color:'#3b82f6'},corpTagText:{color:'#d97706'},
  assetDetail:{fontSize:14,fontWeight:'600',color:'#1e293b',marginBottom:3},
  assetMeta:{flexDirection:'row',gap:8,flexWrap:'wrap'},
  metaText:{fontSize:10,color:'#94a3b8'},
  unitPriceText:{fontSize:10,color:'#3b82f6',marginTop:2},
  descText:{fontSize:10,color:'#cbd5e1',marginTop:2},
  assetVals:{alignItems:'flex-end',minWidth:85},
  assetValMain:{fontSize:14,fontWeight:'bold',color:'#1e293b'},
  assetValUnit:{fontSize:9,color:'#cbd5e1',marginBottom:3},
  assetValUsd:{fontSize:10,color:'#3b82f6',marginBottom:3},
  profitBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:10,marginBottom:2},
  profitBadgeG:{backgroundColor:'#ecfdf5'},profitBadgeR:{backgroundColor:'#fef2f2'},
  profitBadgeT:{fontSize:10,fontWeight:'bold'},
  profitTG:{color:'#10b981'},profitTR:{color:'#ef4444'},
  profitAmt:{fontSize:9,fontWeight:'500'},

  deleteBtn:{position:'absolute',top:6,right:6,width:28,height:28,borderRadius:14,backgroundColor:'#fef2f2',justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:'#fecaca'},
  deleteBtnText:{fontSize:12,color:'#ef4444',fontWeight:'bold'},

  empty:{alignItems:'center',paddingVertical:60},
  emptyIcon:{fontSize:48,marginBottom:12},
  emptyTitle:{fontSize:16,fontWeight:'600',color:'#64748b',marginBottom:6},
  emptySub:{fontSize:13,color:'#94a3b8',textAlign:'center',paddingHorizontal:40},

  // Portfolio
  section:{backgroundColor:'#fff',borderRadius:20,padding:20,marginBottom:16,borderWidth:1,borderColor:'#e2e8f0'},
  sectionTitle:{fontSize:17,fontWeight:'bold',color:'#1e293b',marginBottom:16,textAlign:'center'},
  pOwnerLabel:{fontSize:14,fontWeight:'600',color:'#334155'},
  pOwnerPct:{fontSize:14,fontWeight:'bold'},
  pOwnerBar:{height:20,backgroundColor:'#f1f5f9',borderRadius:10,overflow:'hidden',marginBottom:6},
  pOwnerBarFill:{height:20,borderRadius:10},
  pOwnerVal:{fontSize:13,color:'#64748b'},
  pOwnerUsd:{fontSize:12,color:'#94a3b8'},
  pTotalRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:14,borderTopWidth:1,borderTopColor:'#f1f5f9',marginTop:4},
  pTotalLabel:{fontSize:14,fontWeight:'bold',color:'#334155'},
  pTotalVal:{fontSize:15,fontWeight:'bold',color:'#1e293b',textAlign:'right'},
  pTotalUsd:{fontSize:12,color:'#3b82f6',textAlign:'right',marginTop:2},

  table:{marginBottom:20},
  tHeader:{flexDirection:'row',backgroundColor:'#f8fafc',paddingVertical:12,paddingHorizontal:10,borderRadius:10,marginBottom:4},
  tHCell:{fontWeight:'bold',color:'#64748b',fontSize:11},
  tRow:{flexDirection:'row',paddingVertical:10,paddingHorizontal:10,borderRadius:8,alignItems:'center'},
  tRowE:{backgroundColor:'#fafafa'},tRowO:{backgroundColor:'#fff'},
  tCell:{fontSize:12,color:'#334155'},

  chartTitle:{fontSize:15,fontWeight:'bold',color:'#64748b',marginBottom:16,textAlign:'center'},
  chartLabel:{fontSize:13,fontWeight:'600',color:'#334155'},
  chartPct:{fontSize:13,fontWeight:'bold'},
  chartBar:{height:22,backgroundColor:'#f1f5f9',borderRadius:11,overflow:'hidden',marginBottom:4},
  chartBarFill:{height:22,borderRadius:11},
  chartVal:{fontSize:11,color:'#64748b'},
  chartUsd:{fontSize:11,color:'#3b82f6'},

  tipsCard:{backgroundColor:'#f0fdf4',borderRadius:16,padding:18,marginBottom:16,borderWidth:1,borderColor:'#bbf7d0'},
  tipsTitle:{fontSize:15,fontWeight:'bold',color:'#166534',marginBottom:12,textAlign:'center'},
  tipT:{fontSize:13,color:'#166534',marginBottom:8,lineHeight:22},

  // Modal
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'flex-end'},
  modalContent:{backgroundColor:'#fff',borderTopLeftRadius:28,borderTopRightRadius:28,padding:20,maxHeight:height*0.9},
  modalH:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,paddingBottom:14,borderBottomWidth:1,borderBottomColor:'#f1f5f9'},
  modalTitle:{fontSize:20,fontWeight:'bold',color:'#1e293b'},
  modalSub:{fontSize:12,color:'#94a3b8',marginTop:4},
  modalCloseBtn:{width:36,height:36,borderRadius:18,backgroundColor:'#f1f5f9',justifyContent:'center',alignItems:'center'},
  modalCloseT:{fontSize:18,color:'#64748b',fontWeight:'bold'},

  fieldLabel:{fontSize:13,fontWeight:'600',color:'#334155',marginBottom:6,marginTop:14},
  input:{borderWidth:1.5,borderColor:'#e2e8f0',borderRadius:14,padding:14,fontSize:15,backgroundColor:'#f8fafc',marginBottom:4,color:'#1e293b'},
  textArea:{textAlignVertical:'top',minHeight:80},
  formDiv:{height:1,backgroundColor:'#f1f5f9',marginVertical:12},

  typeChip:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderRadius:25,backgroundColor:'#f1f5f9',marginRight:8,gap:4},
  typeChipA:{},typeChipIcon:{fontSize:16},
  typeChipText:{fontSize:13,color:'#64748b',fontWeight:'500'},typeChipTextA:{color:'#fff',fontWeight:'bold'},
  chipWrap:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:8},
  chip:{paddingHorizontal:16,paddingVertical:10,borderRadius:25,backgroundColor:'#f1f5f9'},
  chipW:{flex:1,alignItems:'center'},chipActive:{backgroundColor:'#3b82f6'},
  chipText:{fontSize:13,color:'#64748b',fontWeight:'500'},chipTextActive:{color:'#fff',fontWeight:'bold'},
  currChip:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:8,borderRadius:20,backgroundColor:'#f1f5f9',marginRight:8,gap:4},
  currChipActive:{backgroundColor:'#3b82f6'},currChipFlag:{fontSize:16},
  currChipText:{fontSize:13,color:'#64748b',fontWeight:'500'},currChipTextActive:{color:'#fff',fontWeight:'bold'},
  selectedCurr:{fontSize:13,color:'#3b82f6',fontWeight:'500',marginBottom:4},

  ownerOpts:{flexDirection:'row',gap:12,marginTop:8},
  ownerOpt:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14,borderRadius:14,backgroundColor:'#f8fafc',borderWidth:2,borderColor:'#e2e8f0'},
  ownerOptA:{backgroundColor:'#eff6ff'},ownerOptIcon:{fontSize:22},
  ownerOptText:{fontSize:14,color:'#64748b',fontWeight:'500'},

  dateBtn:{flexDirection:'row',alignItems:'center',borderWidth:1.5,borderColor:'#e2e8f0',borderRadius:14,padding:14,backgroundColor:'#f8fafc',marginBottom:4,gap:8},
  dateBtnIcon:{fontSize:16},dateBtnText:{fontSize:15,color:'#1e293b',flex:1},dateBtnArrow:{fontSize:12,color:'#94a3b8'},

  jpContainer:{backgroundColor:'#f8fafc',borderRadius:16,padding:16,marginTop:8,marginBottom:8,borderWidth:1,borderColor:'#e2e8f0'},
  jpTitle:{fontSize:15,fontWeight:'bold',color:'#1e293b',textAlign:'center',marginBottom:12},
  jpRow:{flexDirection:'row',gap:8},
  jpCol:{flex:1},jpLabel:{fontSize:12,fontWeight:'600',color:'#94a3b8',textAlign:'center',marginBottom:6},
  jpScroll:{maxHeight:160,borderRadius:10,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2e8f0'},
  jpItem:{paddingVertical:10,paddingHorizontal:8,alignItems:'center',marginHorizontal:2,marginVertical:1,borderRadius:8},
  jpItemActive:{backgroundColor:'#3b82f6'},
  jpItemText:{fontSize:14,color:'#334155'},jpItemTextActive:{color:'#fff',fontWeight:'bold'},
  jpActions:{flexDirection:'row',gap:10,marginTop:12},
  jpCancel:{flex:1,padding:10,borderRadius:10,backgroundColor:'#f1f5f9',alignItems:'center'},
  jpCancelText:{color:'#64748b',fontWeight:'600'},
  jpConfirm:{flex:1,padding:10,borderRadius:10,backgroundColor:'#3b82f6',alignItems:'center'},
  jpConfirmText:{color:'#fff',fontWeight:'bold'},

  modalActions:{flexDirection:'row',gap:12,marginTop:20,marginBottom:10},
  cancelBtn:{flex:1,padding:15,borderRadius:14,backgroundColor:'#f1f5f9',alignItems:'center'},
  cancelBtnT:{color:'#64748b',fontWeight:'600',fontSize:15},
  submitBtn:{flex:1,padding:15,borderRadius:14,backgroundColor:'#3b82f6',alignItems:'center'},
  submitBtnT:{color:'#fff',fontWeight:'bold',fontSize:15},

  autoBtn:{backgroundColor:'#10b981',paddingVertical:14,borderRadius:14,alignItems:'center',marginBottom:16},
  autoBtnT:{color:'#fff',fontWeight:'bold',fontSize:15},
  priceSection:{marginBottom:20},
  priceSectionT:{fontSize:16,fontWeight:'bold',color:'#1e293b',marginBottom:12,paddingBottom:8,borderBottomWidth:1,borderBottomColor:'#f1f5f9'},
  priceGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'},
  priceCard:{width:'48%',backgroundColor:'#f8fafc',borderRadius:14,padding:12,marginBottom:10,borderWidth:1,borderColor:'#e2e8f0'},
  priceCardLabel:{fontSize:11,fontWeight:'600',color:'#64748b',marginBottom:8},
  priceCardInput:{borderWidth:1,borderColor:'#e2e8f0',borderRadius:10,padding:10,fontSize:14,backgroundColor:'#fff',color:'#1e293b'},
  priceSaveBtn:{backgroundColor:'#3b82f6',paddingVertical:16,borderRadius:14,alignItems:'center',marginTop:12},
  priceSaveBtnT:{color:'#fff',fontWeight:'bold',fontSize:16},

  sortModalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'center',alignItems:'center'},
  sortModalContent:{backgroundColor:'#fff',borderRadius:20,padding:20,width:width*0.8,maxHeight:height*0.6},
  sortModalTitle:{fontSize:18,fontWeight:'bold',color:'#1e293b',textAlign:'center',marginBottom:16},
  sortOption:{paddingVertical:14,paddingHorizontal:16,borderRadius:12,marginBottom:4},
  sortOptionA:{backgroundColor:'#eff6ff'},
  sortOptionT:{fontSize:15,color:'#334155'},sortOptionTA:{color:'#3b82f6',fontWeight:'bold'},
});