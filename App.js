// App.js - نسخه نهایی با تمام بهبودها

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
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as jalaali from 'jalaali-js';

// ==================== پلتفرم‌های اختیاری ====================
let ExpoVpnChecker = null;
try {
  ExpoVpnChecker = require('expo-vpn-checker').default;
} catch (e) {
  console.log('expo-vpn-checker not available');
}

const { width, height } = Dimensions.get('window');

// ==================== VERSION & MIGRATION ====================
const DATA_VERSION = 2;

const migrateAsset = (asset) => {
  let migrated = { ...asset };
  const currentVersion = migrated._dataVersion || 1;
  if (currentVersion < 2) {
    migrated.ownership = migrated.ownership || 'personal';
  }
  migrated._dataVersion = DATA_VERSION;
  return migrated;
};

// ==================== JALAALI DATE HELPERS ====================
const getJalaaliDate = (date = new Date()) => {
  const jd = jalaali.toJalaali(date);
  return `${jd.jy}/${String(jd.jm).padStart(2, '0')}/${String(jd.jd).padStart(2, '0')}`;
};

const getIranTime = (utcDate) => {
  const iranTime = new Date(utcDate.getTime() + (3.5 * 60 * 60 * 1000));
  const hours = iranTime.getHours().toString().padStart(2, '0');
  const minutes = iranTime.getMinutes().toString().padStart(2, '0');
  const seconds = iranTime.getSeconds().toString().padStart(2, '0');
  return { time: `${hours}:${minutes}:${seconds}`, date: getJalaaliDate(iranTime) };
};

const gregorianToJalaali = (gDate) => {
  if (!gDate) return '';
  const parts = gDate.split('-');
  if (parts.length !== 3) return gDate;
  const gy = parseInt(parts[0]);
  const gm = parseInt(parts[1]);
  const gd = parseInt(parts[2]);
  const j = jalaali.toJalaali(gy, gm, gd);
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
};

const jalaaliToGregorian = (jDate) => {
  if (!jDate) return '';
  const parts = jDate.split('/');
  if (parts.length !== 3) return jDate;
  const jy = parseInt(parts[0]);
  const jm = parseInt(parts[1]);
  const jd = parseInt(parts[2]);
  try {
    const g = jalaali.toGregorian(jy, jm, jd);
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

const isValidJalaaliDate = (jDate) => {
  if (!jDate) return false;
  const parts = jDate.split('/');
  if (parts.length !== 3) return false;
  const jy = parseInt(parts[0]);
  const jm = parseInt(parts[1]);
  const jd = parseInt(parts[2]);
  if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return false;
  if (jy < 1300 || jy > 1500) return false;
  if (jm < 1 || jm > 12) return false;
  if (jd < 1 || jd > 31) return false;
  if (jm > 6 && jd > 30) return false;
  return jalaali.isValidJalaaliDate(jy, jm, jd);
};

const getJalaaliMonthName = (month) => {
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  return months[month - 1] || '';
};

const getTodayJalaali = () => {
  const now = new Date();
  return getJalaaliDate(now);
};

// ==================== ID GENERATOR ====================
let idCounter = 0;
const generateUniqueId = () => {
  idCounter++;
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).substr(2, 5)}`;
};

// ==================== CONSTANTS ====================
const CURRENCY_CONFIG = {
  USD: { flag: '🇺🇸', name: 'دلار آمریکا', group: 'main' },
  EUR: { flag: '🇪🇺', name: 'یورو', group: 'main' },
  GBP: { flag: '🇬🇧', name: 'پوند انگلیس', group: 'main' },
  CHF: { flag: '🇨🇭', name: 'فرانک سوئیس', group: 'main' },
  CAD: { flag: '🇨🇦', name: 'دلار کانادا', group: 'main' },
  AUD: { flag: '🇦🇺', name: 'دلار استرالیا', group: 'main' },
  SEK: { flag: '🇸🇪', name: 'کرون سوئد', group: 'main' },
  NOK: { flag: '🇳🇴', name: 'کرون نروژ', group: 'main' },
  RUB: { flag: '🇷🇺', name: 'روبل روسیه', group: 'main' },
  THB: { flag: '🇹🇭', name: 'بات تایلند', group: 'main' },
  SGD: { flag: '🇸🇬', name: 'دلار سنگاپور', group: 'other' },
  HKD: { flag: '🇭🇰', name: 'دلار هنگ‌کنگ', group: 'other' },
  AZN: { flag: '🇦🇿', name: 'منات آذربایجان', group: 'other' },
  AMD: { flag: '🇦🇲', name: 'درام ارمنستان', group: 'other' },
  DKK: { flag: '🇩🇰', name: 'کرون دانمارک', group: 'other' },
  AED: { flag: '🇦🇪', name: 'درهم امارات', group: 'other' },
  JPY: { flag: '🇯🇵', name: 'ین ژاپن', group: 'other' },
  TRY: { flag: '🇹🇷', name: 'لیر ترکیه', group: 'other' },
  CNY: { flag: '🇨🇳', name: 'یوان چین', group: 'other' },
  SAR: { flag: '🇸🇦', name: 'ریال سعودی', group: 'other' },
  INR: { flag: '🇮🇳', name: 'روپیه هند', group: 'other' },
  MYR: { flag: '🇲🇾', name: 'رینگیت مالزی', group: 'other' },
  AFN: { flag: '🇦🇫', name: 'افغانی افغانستان', group: 'other' },
  KWD: { flag: '🇰🇼', name: 'دینار کویت', group: 'other' },
  IQD: { flag: '🇮🇶', name: 'دینار عراق', group: 'other' },
  BHD: { flag: '🇧🇭', name: 'دینار بحرین', group: 'other' },
  OMR: { flag: '🇴🇲', name: 'ریال عمان', group: 'other' },
  QAR: { flag: '🇶🇦', name: 'ریال قطر', group: 'other' },
};

const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_CONFIG);
const MAIN_CURRENCIES = SUPPORTED_CURRENCIES.filter(c => CURRENCY_CONFIG[c].group === 'main');
const OTHER_CURRENCIES = SUPPORTED_CURRENCIES.filter(c => CURRENCY_CONFIG[c].group === 'other');

const COIN_TYPES = ['سکه امامی', 'بهار آزادی', 'نیم سکه', 'ربع سکه', 'سکه گرمی'];
const ASSET_TYPES = ['حساب بانکی', 'پول نقد', 'ارز', 'سکه', 'طلا', 'اوراق بهادار و سهام', 'سایر'];

const ASSET_ICONS = {
  'حساب بانکی': '🏦', 'پول نقد': '💰', 'ارز': '💵',
  'سکه': '🪙', 'طلا': '🥇', 'اوراق بهادار و سهام': '📈', 'سایر': '📦',
};

const ASSET_COLORS = {
  'حساب بانکی': '#2196f3', 'پول نقد': '#4caf50', 'ارز': '#ff9800',
  'سکه': '#9c27b0', 'طلا': '#ffc107', 'اوراق بهادار و سهام': '#f44336', 'سایر': '#607d8b',
};

const getCurrencyFlag = (code) => CURRENCY_CONFIG[code]?.flag || '💱';
const getCurrencyName = (code) => CURRENCY_CONFIG[code]?.name || code;
const getIconForType = (type) => ASSET_ICONS[type] || '📦';
const getColorForType = (type) => ASSET_COLORS[type] || '#607d8b';

// ==================== UTILITY FUNCTIONS ====================
const formatTomans = (num) => {
  if (num == null || isNaN(num)) return 'N/A';
  return Math.round(num).toLocaleString('fa-IR');
};

const formatUSD = (amount) => {
  if (amount == null || isNaN(amount)) return 'N/A';
  return `$${Math.round(amount).toLocaleString('en-US')}`;
};

const formatCompactNumber = (num) => {
  if (num == null) return 'N/A';
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)} هزار میلیارد`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)} میلیارد`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)} میلیون`;
  return Math.round(num).toLocaleString('fa-IR');
};

const validateAsset = (asset) => {
  const errors = [];
  if (!asset.type) errors.push('نوع دارایی الزامی است');
  if (!asset.detail && !['حساب بانکی', 'پول نقد', 'سایر'].includes(asset.type)) {
    errors.push('جزئیات دارایی الزامی است');
  }
  if (asset.type === 'ارز' && !SUPPORTED_CURRENCIES.includes(asset.detail)) {
    errors.push('نوع ارز معتبر نیست');
  }
  if (asset.quantity != null && asset.quantity < 0) {
    errors.push('مقدار نمی‌تواند منفی باشد');
  }
  if (asset.buyPriceTotal != null && asset.buyPriceTotal < 0) {
    errors.push('قیمت خرید نمی‌تواند منفی باشد');
  }
  if (asset.buyDateJalaali && !isValidJalaaliDate(asset.buyDateJalaali)) {
    errors.push('تاریخ خرید معتبر نیست');
  }
  return errors;
};

const DEFAULT_PRICES = {
  USD: 0, EUR: 0, GBP: 0, CHF: 0, CAD: 0, AUD: 0, SEK: 0, NOK: 0,
  RUB: 0, THB: 0, SGD: 0, HKD: 0, AZN: 0, AMD: 0, DKK: 0, AED: 0,
  JPY: 0, TRY: 0, CNY: 0, SAR: 0, INR: 0, MYR: 0, AFN: 0, KWD: 0,
  IQD: 0, BHD: 0, OMR: 0, QAR: 0,
  GOLD_18_PER_GRAM: 0, GOLD_24_PER_GRAM: 0,
  COIN_EMAMI: 0, COIN_NIM: 0, COIN_ROB: 0, COIN_GERAMI: 0, COIN_BAHAR: 0,
};

// ==================== ASSET ITEM COMPONENT ====================
const AssetItem = React.memo(({ asset, currentPrice, unitPrice, profitLoss, onPress, onDelete }) => {
  const currentValue = currentPrice ? currentPrice * asset.quantity : asset.buyPriceTotal;
  const isProfit = profitLoss?.profit >= 0;
  const displayDate = asset.buyDateJalaali || (asset.buyDate ? gregorianToJalaali(asset.buyDate) : '');

  return (
    <View style={styles.assetItemContainer}>
      <TouchableOpacity
        style={styles.assetItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.assetRow}>
          <View style={[styles.assetIcon, { backgroundColor: `${getColorForType(asset.type)}15` }]}>
            <Text style={styles.assetIconText}>{getIconForType(asset.type)}</Text>
            <View style={[styles.ownershipBadge, { borderColor: asset.ownership === 'corporate' ? '#ff9800' : '#2196f3' }]}>
              <Text style={styles.ownershipBadgeText}>
                {asset.ownership === 'corporate' ? '🏢' : '👤'}
              </Text>
            </View>
          </View>

          <View style={styles.assetInfo}>
            <View style={styles.assetHeader}>
              <Text style={[styles.assetType, { color: getColorForType(asset.type) }]}>
                {asset.type}
              </Text>
              <View style={[
                styles.ownershipTag,
                asset.ownership === 'corporate' ? styles.corporateTag : styles.personalTag
              ]}>
                <Text style={[
                  styles.ownershipTagText,
                  asset.ownership === 'corporate' ? styles.corporateTagText : styles.personalTagText
                ]}>
                  {asset.ownership === 'corporate' ? 'شرکتی' : 'شخصی'}
                </Text>
              </View>
            </View>

            <Text style={styles.assetDetail}>
              {asset.type === 'ارز' ? `${getCurrencyFlag(asset.detail)} ${asset.detail}` : asset.detail}
            </Text>

            <View style={styles.assetMeta}>
              {asset.type === 'ارز' && <Text style={styles.assetMetaText}>💱 {asset.quantity} واحد</Text>}
              {asset.type === 'سکه' && <Text style={styles.assetMetaText}>🪙 {asset.quantity} عدد</Text>}
              {asset.type === 'طلا' && <Text style={styles.assetMetaText}>⚖️ {asset.quantity} گرم</Text>}
              {asset.type === 'اوراق بهادار و سهام' && <Text style={styles.assetMetaText}>📊 {asset.quantity} سهم</Text>}
              {displayDate ? <Text style={styles.assetMetaText}>📅 {displayDate}</Text> : null}
            </View>

            {/* نمایش قیمت واحد فعلی */}
            {unitPrice && !['حساب بانکی', 'پول نقد', 'سایر'].includes(asset.type) && (
              <Text style={styles.assetUnitPrice}>
                قیمت واحد: {formatTomans(unitPrice)} تومان
              </Text>
            )}

            {asset.description ? (
              <Text style={styles.assetDesc} numberOfLines={1}>📝 {asset.description}</Text>
            ) : null}
          </View>

          <View style={styles.assetValues}>
            <Text style={styles.assetCurrentValue}>{formatTomans(currentValue)}</Text>
            <Text style={styles.assetValueLabel}>تومان</Text>
            {profitLoss && (
              <View style={[styles.profitBadge, isProfit ? styles.profitBadgeGreen : styles.profitBadgeRed]}>
                <Text style={[styles.profitBadgeText, isProfit ? styles.profitTextGreen : styles.profitTextRed]}>
                  {isProfit ? '▲' : '▼'} {Math.abs(profitLoss.profitPercent).toFixed(1)}%
                </Text>
              </View>
            )}
            {profitLoss && (
              <Text style={[styles.profitAmount, isProfit ? styles.positive : styles.negative]}>
                {isProfit ? '+' : '-'}{formatTomans(Math.abs(profitLoss.profit))}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      {/* دکمه حذف */}
      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );
});

// ==================== PRICE CARD COMPONENT ====================
const PriceCard = React.memo(({ label, priceKey, value, onUpdate }) => (
  <View style={styles.priceCard}>
    <Text style={styles.priceCardLabel}>{label}</Text>
    <TextInput
      style={styles.priceCardInput}
      keyboardType="numeric"
      value={value?.toString() || '0'}
      onChangeText={text => onUpdate(priceKey, text)}
      placeholder="0"
      placeholderTextColor="#ccc"
    />
  </View>
));

// ==================== JALAALI DATE PICKER COMPONENT ====================
const JalaaliDatePicker = React.memo(({ value, onChange }) => {
  const today = jalaali.toJalaali(new Date());
  const parts = value ? value.split('/') : [];
  const [year, setYear] = useState(parts[0] || String(today.jy));
  const [month, setMonth] = useState(parts[1] || String(today.jm));
  const [day, setDay] = useState(parts[2] || String(today.jd));
  const [showPicker, setShowPicker] = useState(false);

  const years = [];
  for (let y = today.jy; y >= today.jy - 30; y--) years.push(y);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const maxDay = parseInt(month) <= 6 ? 31 : parseInt(month) <= 11 ? 30 : (jalaali.isLeapJalaaliYear(parseInt(year)) ? 30 : 29);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const applyDate = () => {
    const dateStr = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    if (isValidJalaaliDate(dateStr)) {
      onChange(dateStr);
      setShowPicker(false);
    } else {
      Alert.alert('خطا', 'تاریخ وارد شده معتبر نیست');
    }
  };

  useEffect(() => {
    if (value) {
      const p = value.split('/');
      if (p.length === 3) {
        setYear(p[0]);
        setMonth(p[1].replace(/^0/, ''));
        setDay(p[2].replace(/^0/, ''));
      }
    }
  }, [value]);

  return (
    <View>
      <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(!showPicker)}>
        <Text style={styles.dateButtonIcon}>📅</Text>
        <Text style={styles.dateButtonText}>
          {value ? `${value} (${getJalaaliMonthName(parseInt(month))})` : 'انتخاب تاریخ شمسی'}
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <View style={styles.jalaaliPickerContainer}>
          <Text style={styles.jalaaliPickerTitle}>📅 انتخاب تاریخ شمسی</Text>
          
          <View style={styles.jalaaliPickerRow}>
            {/* سال */}
            <View style={styles.jalaaliPickerColumn}>
              <Text style={styles.jalaaliPickerLabel}>سال</Text>
              <ScrollView style={styles.jalaaliPickerScroll} nestedScrollEnabled={true}>
                {years.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.jalaaliPickerItem, parseInt(year) === y && styles.jalaaliPickerItemActive]}
                    onPress={() => setYear(String(y))}
                  >
                    <Text style={[styles.jalaaliPickerItemText, parseInt(year) === y && styles.jalaaliPickerItemTextActive]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ماه */}
            <View style={styles.jalaaliPickerColumn}>
              <Text style={styles.jalaaliPickerLabel}>ماه</Text>
              <ScrollView style={styles.jalaaliPickerScroll} nestedScrollEnabled={true}>
                {months.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.jalaaliPickerItem, parseInt(month) === m && styles.jalaaliPickerItemActive]}
                    onPress={() => setMonth(String(m))}
                  >
                    <Text style={[styles.jalaaliPickerItemText, parseInt(month) === m && styles.jalaaliPickerItemTextActive]}>
                      {getJalaaliMonthName(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* روز */}
            <View style={styles.jalaaliPickerColumn}>
              <Text style={styles.jalaaliPickerLabel}>روز</Text>
              <ScrollView style={styles.jalaaliPickerScroll} nestedScrollEnabled={true}>
                {days.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.jalaaliPickerItem, parseInt(day) === d && styles.jalaaliPickerItemActive]}
                    onPress={() => setDay(String(d))}
                  >
                    <Text style={[styles.jalaaliPickerItemText, parseInt(day) === d && styles.jalaaliPickerItemTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.jalaaliPickerActions}>
            <TouchableOpacity style={styles.jalaaliPickerCancel} onPress={() => setShowPicker(false)}>
              <Text style={styles.jalaaliPickerCancelText}>انصراف</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.jalaaliPickerConfirm} onPress={applyDate}>
              <Text style={styles.jalaaliPickerConfirmText}>✓ تأیید</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

// ==================== STICKY HEADER COMPONENT ====================
const StickyHeader = React.memo(({ totalValue, totalValueInUSD, isVisible }) => {
  if (!isVisible) return null;
  
  return (
    <View style={styles.stickyHeader}>
      <Text style={styles.stickyHeaderText}>
        💰 {formatCompactNumber(totalValue)} تومان
      </Text>
      {totalValueInUSD !== null && (
        <Text style={styles.stickyHeaderUsd}>
          ≈ {formatUSD(totalValueInUSD)}
        </Text>
      )}
    </View>
  );
});

// ==================== MAIN APP ====================
export default function App() {
  // ===== State =====
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [monthlyChange, setMonthlyChange] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [activeTab, setActiveTab] = useState('assets');
  const scrollViewRef = useRef(null);

  // مودال واحد
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [assetModalMode, setAssetModalMode] = useState('add'); // 'add' | 'edit'
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedAssetType, setSelectedAssetType] = useState('حساب بانکی');
  const [formData, setFormData] = useState({ quantity: 1, ownership: 'personal', buyDateJalaali: getTodayJalaali() });

  const [manualPrices, setManualPrices] = useState({ ...DEFAULT_PRICES });
  const [exchangeRates, setExchangeRates] = useState({});
  const [snapshots, setSnapshots] = useState([]);
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [showOwnershipChart, setShowOwnershipChart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const [isVpnActive, setIsVpnActive] = useState(false);
  const [vpnStatusText, setVpnStatusText] = useState('در حال بررسی...');
  const [isLoading, setIsLoading] = useState(true);
  const [isPriceUpdating, setIsPriceUpdating] = useState(false);

  // ===== Core Functions =====
  const getCurrentPrice = useCallback((asset) => {
    const { type, detail } = asset;

    if (type === 'ارز') {
      const directPrice = manualPrices[detail];
      if (directPrice && directPrice > 0) return directPrice;
      if (manualPrices.USD && manualPrices.USD > 0 && exchangeRates[detail]) {
        return manualPrices.USD / exchangeRates[detail];
      }
      return null;
    }

    if (type === 'سکه') {
      const coinMap = {
        'سکه امامی': manualPrices.COIN_EMAMI,
        'بهار آزادی': manualPrices.COIN_BAHAR,
        'نیم سکه': manualPrices.COIN_NIM,
        'ربع سکه': manualPrices.COIN_ROB,
        'سکه گرمی': manualPrices.COIN_GERAMI,
      };
      return coinMap[detail] || null;
    }

    if (type === 'طلا') {
      if (detail === '18 عیار') return manualPrices.GOLD_18_PER_GRAM;
      if (detail === '24 عیار') return manualPrices.GOLD_24_PER_GRAM;
      return null;
    }

    if (['حساب بانکی', 'پول نقد', 'سایر'].includes(type)) {
      return asset.buyPriceTotal || 0;
    }

    return null;
  }, [manualPrices, exchangeRates]);

  const getProfitLoss = useCallback((asset) => {
    const currentPrice = getCurrentPrice(asset);
    if (!currentPrice || !asset.buyPriceTotal) return null;
    if (['حساب بانکی', 'پول نقد', 'سایر'].includes(asset.type)) return null;
    const currentValue = currentPrice * asset.quantity;
    const profit = currentValue - asset.buyPriceTotal;
    const profitPercent = asset.buyPriceTotal > 0 ? (profit / asset.buyPriceTotal) * 100 : 0;
    return { profit, profitPercent };
  }, [getCurrentPrice]);

  // ===== Memoized Values =====
  const totalValueInUSD = useMemo(() => {
    if (!manualPrices.USD || manualPrices.USD === 0) return null;
    return totalValue / manualPrices.USD;
  }, [totalValue, manualPrices.USD]);

  const filteredAssets = useMemo(() => {
    let result = assets;
    
    // فیلتر مالکیت
    if (ownershipFilter !== 'all') {
      result = result.filter(a => a.ownership === ownershipFilter);
    }
    
    // فیلتر جستجو
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(a => {
        const searchFields = [
          a.type, a.detail, a.description,
          a.ownership === 'corporate' ? 'شرکتی' : 'شخصی',
          a.buyDateJalaali || '',
        ].filter(Boolean).join(' ').toLowerCase();
        return searchFields.includes(query);
      });
    }
    
    return result;
  }, [assets, ownershipFilter, searchQuery]);

  const ownershipStats = useMemo(() => {
    let personalValue = 0, corporateValue = 0, personalCount = 0, corporateCount = 0;

    assets.forEach(asset => {
      const price = getCurrentPrice(asset);
      let value;
      if (['حساب بانکی', 'پول نقد', 'سایر'].includes(asset.type)) {
        value = asset.buyPriceTotal || 0;
      } else {
        value = price ? price * asset.quantity : asset.buyPriceTotal || 0;
      }

      if (asset.ownership === 'corporate') {
        corporateValue += value;
        corporateCount++;
      } else {
        personalValue += value;
        personalCount++;
      }
    });

    const total = personalValue + corporateValue;
    return {
      personal: { value: personalValue, percent: total > 0 ? (personalValue / total) * 100 : 0, count: personalCount },
      corporate: { value: corporateValue, percent: total > 0 ? (corporateValue / total) * 100 : 0, count: corporateCount },
      total,
    };
  }, [assets, getCurrentPrice]);

  const portfolioData = useMemo(() => {
    const itemTotals = {};
    let total = 0;

    assets.forEach(asset => {
      const price = getCurrentPrice(asset);
      let value;
      if (['حساب بانکی', 'پول نقد', 'سایر'].includes(asset.type)) {
        value = asset.buyPriceTotal || 0;
      } else {
        value = price ? price * asset.quantity : asset.buyPriceTotal || 0;
      }
      total += value;

      const key = `${asset.type}_${asset.detail}`;
      if (itemTotals[key]) {
        itemTotals[key].value += value;
        itemTotals[key].quantity += asset.quantity;
      } else {
        itemTotals[key] = { type: asset.type, detail: asset.detail, value, quantity: asset.quantity };
      }
    });

    const portfolio = Object.values(itemTotals)
      .map(item => ({ ...item, percent: total > 0 ? (item.value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    return { portfolio, total };
  }, [assets, getCurrentPrice]);

  // ===== API Calls =====
  const fetchOnlinePrices = useCallback(async (showAlert = true) => {
    try {
      setIsPriceUpdating(true);
      const timestamp = Date.now();
      const url = `https://raw.githubusercontent.com/nvdtairbus-ctrl/AssetManager/main/prices.json?t=${timestamp}`;

      const response = await fetch(url, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' },
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);

      let data;
      try { data = await response.json(); } 
      catch (parseError) { throw new Error(`خطا در پردازش داده‌ها: ${parseError.message}`); }

      if (!data || !data.usd) throw new Error('داده‌های دریافتی کامل نیست');

      const newPrices = {
        ...DEFAULT_PRICES,
        USD: data.usd, EUR: data.eur || 0, GBP: data.gbp || 0, CHF: data.chf || 0,
        CAD: data.cad || 0, AUD: data.aud || 0, SEK: data.sek || 0, NOK: data.nok || 0,
        RUB: data.rub || 0, THB: data.thb || 0, SGD: data.sgd || 0, HKD: data.hkd || 0,
        AZN: data.azn || 0, AMD: data.amd || 0, DKK: data.dkk || 0, AED: data.aed || 0,
        JPY: data.jpy || 0, TRY: data.try || 0, CNY: data.cny || 0, SAR: data.sar || 0,
        INR: data.inr || 0, MYR: data.myr || 0, AFN: data.afn || 0, KWD: data.kwd || 0,
        IQD: data.iqd || 0, BHD: data.bhd || 0, OMR: data.omr || 0, QAR: data.qar || 0,
        GOLD_18_PER_GRAM: data.gold || 0,
        GOLD_24_PER_GRAM: data.gold ? Math.round(data.gold * (24 / 18)) : 0,
        COIN_EMAMI: data.emami_coin || 0,
        COIN_NIM: data.nim_coin || 0,
        COIN_ROB: data.rob_coin || 0,
        COIN_GERAMI: data.gold ? Math.round(data.gold / 4.5) : 0,
        COIN_BAHAR: data.emami_coin ? Math.round(data.emami_coin * 0.95) : 0,
      };

      setManualPrices(newPrices);
      await AsyncStorage.setItem('manualPrices', JSON.stringify(newPrices));
      setIsOnline(true);

      if (showAlert) {
        if (data.last_update) {
          const { date, time } = getIranTime(new Date(data.last_update));
          Alert.alert('✅ بروزرسانی موفق', `📅 ${date}\n⏰ ${time}\n💵 دلار: ${newPrices.USD.toLocaleString()} تومان`);
        } else {
          Alert.alert('✅ بروزرسانی موفق', `💵 دلار: ${newPrices.USD.toLocaleString()} تومان`);
        }
      }
      return newPrices;
    } catch (error) {
      console.log('❌ خطا در دریافت قیمت:', error.message);
      setIsOnline(false);
      if (showAlert) Alert.alert('⚠️ خطا', `${error.message}\n\nلطفاً اینترنت را بررسی کنید.`);
      return null;
    } finally {
      setIsPriceUpdating(false);
    }
  }, []);

  const fetchExchangeRates = useCallback(async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const data = await response.json();
      if (!data || !data.rates) throw new Error('داده‌های نرخ ارز ناقص است');

      const filteredRates = {};
      SUPPORTED_CURRENCIES.forEach(currency => {
        if (data.rates[currency]) filteredRates[currency] = data.rates[currency];
      });
      setExchangeRates(filteredRates);
      await AsyncStorage.setItem('exchangeRates', JSON.stringify(filteredRates));
      const now = getJalaaliDate() + ' ' + new Date().toLocaleTimeString('fa-IR');
      await AsyncStorage.setItem('lastUpdateTime', now);
      setLastUpdateTime(now);
      setIsOnline(true);
    } catch (error) {
      console.log('خطا در دریافت نرخ ارز:', error.message);
      setIsOnline(false);
    }
  }, []);

  // ===== Data Management =====
  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [savedAssets, savedPrices, savedRates, savedSnapshots, savedUpdateTime] = await Promise.all([
        AsyncStorage.getItem('assets'),
        AsyncStorage.getItem('manualPrices'),
        AsyncStorage.getItem('exchangeRates'),
        AsyncStorage.getItem('snapshots'),
        AsyncStorage.getItem('lastUpdateTime'),
      ]);

      if (savedAssets) {
        try {
          const parsed = JSON.parse(savedAssets);
          const needsMigration = parsed.some(a => (a._dataVersion || 1) < DATA_VERSION);
          const migrated = parsed.map(a => {
            const m = migrateAsset(a);
            // Migration: تبدیل buyDate میلادی به جلالی اگر buyDateJalaali نداشته باشد
            if (!m.buyDateJalaali && m.buyDate) {
              m.buyDateJalaali = gregorianToJalaali(m.buyDate);
            }
            // حساب بانکی و پول نقد: quantity = 1
            if (['حساب بانکی', 'پول نقد'].includes(m.type)) {
              m.quantity = 1;
            }
            return m;
          });
          setAssets(migrated);
          if (needsMigration || parsed.some(a => !a.buyDateJalaali && a.buyDate)) {
            await AsyncStorage.setItem('assets', JSON.stringify(migrated));
          }
        } catch (parseError) {
          console.error('خطا در خواندن دارایی‌ها:', parseError);
          await AsyncStorage.setItem('assets_backup', savedAssets);
          setAssets([]);
        }
      }

      if (savedPrices) { try { setManualPrices(JSON.parse(savedPrices)); } catch (e) { console.error(e); } }
      if (savedRates) { try { setExchangeRates(JSON.parse(savedRates)); } catch (e) { console.error(e); } }
      if (savedSnapshots) { try { setSnapshots(JSON.parse(savedSnapshots)); } catch (e) { console.error(e); } }
      if (savedUpdateTime) setLastUpdateTime(savedUpdateTime);
    } catch (error) {
      console.error('خطا در بارگذاری:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const calculateTotalValue = useCallback(() => {
    let total = 0;
    assets.forEach(asset => {
      if (['حساب بانکی', 'پول نقد', 'سایر'].includes(asset.type)) {
        total += asset.buyPriceTotal || 0;
      } else {
        const price = getCurrentPrice(asset);
        total += price ? price * asset.quantity : asset.buyPriceTotal || 0;
      }
    });
    setTotalValue(total);

    // Save snapshot - به صورت async جداگانه
    const today = new Date().toISOString().split('T')[0];
    setSnapshots(prev => {
      const newSnapshots = [...prev];
      const existingIndex = newSnapshots.findIndex(s => s.date === today);
      if (existingIndex >= 0) newSnapshots[existingIndex].value = total;
      else newSnapshots.push({ date: today, value: total });
      
      // Sort by date
      newSnapshots.sort((a, b) => a.date.localeCompare(b.date));
      const last60Days = newSnapshots.slice(-60);
      
      // Save async
      AsyncStorage.setItem('snapshots', JSON.stringify(last60Days)).catch(console.error);

      // Monthly change - sort شده پس اولین آیتم قدیمی‌ترین است
      if (last60Days.length >= 2) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        // پیدا کردن نزدیک‌ترین snapshot به 30 روز پیش
        let closestSnapshot = null;
        let minDiff = Infinity;
        last60Days.forEach(s => {
          if (s.date <= thirtyDaysAgoStr) {
            const diff = Math.abs(new Date(thirtyDaysAgoStr) - new Date(s.date));
            if (diff < minDiff) {
              minDiff = diff;
              closestSnapshot = s;
            }
          }
        });
        
        if (closestSnapshot && closestSnapshot.value > 0) {
          setMonthlyChange(((total - closestSnapshot.value) / closestSnapshot.value) * 100);
        } else {
          setMonthlyChange(null);
        }
      }

      return last60Days;
    });
  }, [assets, getCurrentPrice]);

  const saveAsset = useCallback(async (asset) => {
    const errors = validateAsset(asset);
    if (errors.length > 0) {
      Alert.alert('⚠️ خطای اعتبارسنجی', errors.join('\n'));
      return false;
    }

    // برای حساب بانکی و پول نقد، quantity همیشه ۱ است
    const fixedQuantity = ['حساب بانکی', 'پول نقد'].includes(asset.type) ? 1 : (asset.quantity || 1);

    const assetWithDefaults = {
      ...asset,
      ownership: asset.ownership || 'personal',
      quantity: fixedQuantity,
      buyPriceTotal: asset.buyPriceTotal || 0,
      buyDate: asset.buyDateJalaali ? jalaaliToGregorian(asset.buyDateJalaali) : new Date().toISOString().split('T')[0],
      buyDateJalaali: asset.buyDateJalaali || getTodayJalaali(),
      _dataVersion: DATA_VERSION,
    };

    let newAssets;
    if (assetModalMode === 'edit' && selectedAsset) {
      newAssets = assets.map(a =>
        a.id === selectedAsset.id ? { ...assetWithDefaults, id: selectedAsset.id } : a
      );
    } else {
      newAssets = [...assets, { ...assetWithDefaults, id: generateUniqueId() }];
    }

    setAssets(newAssets);
    await AsyncStorage.setItem('assets', JSON.stringify(newAssets));
    setAssetModalVisible(false);
    setSelectedAsset(null);
    setFormData({ quantity: 1, ownership: 'personal', buyDateJalaali: getTodayJalaali() });
    
    // پیام تأیید
    Alert.alert(
      assetModalMode === 'edit' ? '✅ ویرایش شد' : '✅ ثبت شد',
      `دارایی "${assetWithDefaults.detail || assetWithDefaults.type}" با موفقیت ${assetModalMode === 'edit' ? 'ویرایش' : 'ثبت'} شد.`,
      [{ text: 'باشه', style: 'default' }]
    );
    
    return true;
  }, [assets, selectedAsset, assetModalMode]);

  const deleteAsset = useCallback((id, name) => {
    Alert.alert(
      '🗑️ حذف دارایی',
      `آیا از حذف "${name || 'این دارایی'}" اطمینان دارید؟`,
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            const newAssets = assets.filter(a => a.id !== id);
            setAssets(newAssets);
            await AsyncStorage.setItem('assets', JSON.stringify(newAssets));
            Alert.alert('✅ حذف شد', 'دارایی با موفقیت حذف شد.');
          },
        },
      ]
    );
  }, [assets]);

  const updateManualPrice = useCallback(async (key, value) => {
    const cleaned = String(value).replace(/,/g, '');
    const numValue = Number(cleaned);
    if (isNaN(numValue) || numValue < 0) return;

    setManualPrices(prev => {
      const newPrices = { ...prev, [key]: numValue };
      AsyncStorage.setItem('manualPrices', JSON.stringify(newPrices)).catch(console.error);
      return newPrices;
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchExchangeRates(), fetchOnlinePrices(false)]);
    setRefreshing(false);
  }, [fetchExchangeRates, fetchOnlinePrices]);

  const openAddModal = useCallback(() => {
    setAssetModalMode('add');
    setSelectedAsset(null);
    setSelectedAssetType('حساب بانکی');
    setFormData({ quantity: 1, ownership: 'personal', buyDateJalaali: getTodayJalaali() });
    setAssetModalVisible(true);
  }, []);

  const openEditModal = useCallback((asset) => {
    setAssetModalMode('edit');
    setSelectedAsset(asset);
    setSelectedAssetType(asset.type);
    setFormData({
      detail: asset.detail,
      quantity: asset.quantity,
      buyPriceTotal: asset.buyPriceTotal,
      buyDateJalaali: asset.buyDateJalaali || (asset.buyDate ? gregorianToJalaali(asset.buyDate) : getTodayJalaali()),
      description: asset.description,
      ownership: asset.ownership || 'personal',
    });
    setAssetModalVisible(true);
  }, []);

  // ===== Effects =====
  useEffect(() => {
    const checkVpn = async () => {
      try {
        if (Platform.OS !== 'web' && ExpoVpnChecker) {
          const result = await ExpoVpnChecker.checkVpn();
          setIsVpnActive(result);
          setVpnStatusText(result ? '✅ VPN فعال' : '⚠️ VPN غیرفعال');
        } else {
          setVpnStatusText('—');
        }
      } catch (error) {
        setVpnStatusText('❌ خطا');
      }
    };
    checkVpn();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await loadAllData();
      if (!isMounted) return;
      await fetchExchangeRates();
      if (!isMounted) return;
      await fetchOnlinePrices(false);
    };
    init();
    const interval = setInterval(() => {
      if (isMounted) {
        fetchExchangeRates();
        fetchOnlinePrices(false);
      }
    }, 21600000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!isLoading) calculateTotalValue();
  }, [assets, manualPrices, exchangeRates, isLoading]);

  // ===== Navigation =====
  const handleScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    const tab = page === 0 ? 'assets' : 'portfolio';
    if (tab !== activeTab) setActiveTab(tab);
  }, [activeTab]);

  const scrollToPage = useCallback((page) => {
    scrollViewRef.current?.scrollTo({ x: page * width, animated: true });
  }, []);

  const handleAssetsScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowStickyHeader(offsetY > 280);
  }, []);

  // ===== Render Helpers =====
  const renderOwnershipSelector = () => (
    <View style={styles.ownershipSelector}>
      <Text style={styles.fieldLabel}>🏷️ نوع مالکیت</Text>
      <View style={styles.ownershipOptions}>
        {[
          { id: 'personal', icon: '👤', label: 'شخصی', color: '#2196f3' },
          { id: 'corporate', icon: '🏢', label: 'شرکتی', color: '#ff9800' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.ownershipOption,
              formData.ownership === opt.id && [styles.ownershipOptionActive, { borderColor: opt.color }],
            ]}
            onPress={() => setFormData(prev => ({ ...prev, ownership: opt.id }))}
          >
            <Text style={styles.ownershipOptionIcon}>{opt.icon}</Text>
            <Text style={[
              styles.ownershipOptionText,
              formData.ownership === opt.id && { color: opt.color, fontWeight: 'bold' },
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderFormField = (label, placeholder, key, keyboardType = 'default', isNumeric = false) => (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        keyboardType={keyboardType}
        value={formData[key] != null ? String(formData[key]) : ''}
        onChangeText={text => {
          if (isNumeric) {
            const num = key === 'quantity' ? parseFloat(text) || 0 : parseInt(text.replace(/,/g, '')) || 0;
            setFormData(prev => ({ ...prev, [key]: num }));
          } else {
            setFormData(prev => ({ ...prev, [key]: text }));
          }
        }}
      />
    </>
  );

  const renderAssetForm = () => {
    switch (selectedAssetType) {
      case 'حساب بانکی':
        return (
          <>
            {renderFormField('🏦 نام بانک یا موسسه', 'مثال: ملت، صادرات', 'detail')}
            {renderFormField('💰 موجودی (تومان)', 'مثال: 50000000', 'buyPriceTotal', 'numeric', true)}
          </>
        );
      case 'پول نقد':
        return (
          <>
            {renderFormField('💵 منبع پول نقد', 'مثال: صندوق منزل', 'detail')}
            {renderFormField('💰 میزان (تومان)', 'مثال: 25000000', 'buyPriceTotal', 'numeric', true)}
          </>
        );
      case 'ارز':
        return (
          <>
            <Text style={styles.fieldLabel}>💱 نوع ارز</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyScrollView} nestedScrollEnabled={true}>
              {SUPPORTED_CURRENCIES.map(currency => (
                <TouchableOpacity
                  key={currency}
                  style={[styles.currencyChip, formData.detail === currency && styles.currencyChipActive]}
                  onPress={() => setFormData(prev => ({ ...prev, detail: currency }))}
                >
                  <Text style={styles.currencyChipFlag}>{getCurrencyFlag(currency)}</Text>
                  <Text style={[styles.currencyChipText, formData.detail === currency && styles.currencyChipTextActive]}>
                    {currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {formData.detail && (
              <Text style={styles.selectedCurrencyName}>
                {getCurrencyFlag(formData.detail)} {getCurrencyName(formData.detail)}
                {manualPrices[formData.detail] > 0 && ` — قیمت فعلی: ${formatTomans(manualPrices[formData.detail])} تومان`}
              </Text>
            )}
            {renderFormField('📊 مقدار ارز', 'مثال: 500', 'quantity', 'numeric', true)}
            {renderFormField('💰 قیمت کل خرید (تومان)', 'مثال: 40000000', 'buyPriceTotal', 'numeric', true)}
          </>
        );
      case 'سکه':
        return (
          <>
            <Text style={styles.fieldLabel}>🪙 نوع سکه</Text>
            <View style={styles.chipContainer}>
              {COIN_TYPES.map(coin => (
                <TouchableOpacity
                  key={coin}
                  style={[styles.chip, formData.detail === coin && styles.chipActive]}
                  onPress={() => setFormData(prev => ({ ...prev, detail: coin }))}
                >
                  <Text style={[styles.chipText, formData.detail === coin && styles.chipTextActive]}>{coin}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {renderFormField('🔢 تعداد', 'مثال: 2', 'quantity', 'numeric', true)}
            {renderFormField('💰 قیمت کل خرید (تومان)', 'مثال: 70000000', 'buyPriceTotal', 'numeric', true)}
          </>
        );
      case 'طلا':
        return (
          <>
            <Text style={styles.fieldLabel}>🥇 عیار طلا</Text>
            <View style={styles.chipContainer}>
              {['18 عیار', '24 عیار'].map(karat => (
                <TouchableOpacity
                  key={karat}
                  style={[styles.chip, styles.chipWide, formData.detail === karat && styles.chipActive]}
                  onPress={() => setFormData(prev => ({ ...prev, detail: karat }))}
                >
                  <Text style={[styles.chipText, formData.detail === karat && styles.chipTextActive]}>{karat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {renderFormField('⚖️ وزن (گرم)', 'مثال: 10.5', 'quantity', 'numeric', true)}
            {renderFormField('💰 قیمت کل خرید (تومان)', 'مثال: 10000000', 'buyPriceTotal', 'numeric', true)}
          </>
        );
      case 'اوراق بهادار و سهام':
        return (
          <>
            {renderFormField('📈 نماد/نام صندوق', 'مثال: شستا', 'detail')}
            {renderFormField('📊 حجم (تعداد سهم)', 'مثال: 1000', 'quantity', 'numeric', true)}
            {renderFormField('💰 قیمت کل خرید (تومان)', 'مثال: 5000000', 'buyPriceTotal', 'numeric', true)}
          </>
        );
      default:
        return (
          <>
            {renderFormField('📦 نام دارایی', 'مثال: خودرو، ملک', 'detail')}
            {renderFormField('💰 ارزش کل (تومان)', 'مثال: 500000000', 'buyPriceTotal', 'numeric', true)}
          </>
        );
    }
  };

  // ===== Main Renders =====
  const renderStatusBar = () => (
    <View style={styles.statusBar}>
      <View style={styles.statusItem}>
        <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
        <Text style={styles.statusText}>{isOnline ? 'آنلاین' : 'آفلاین'}</Text>
      </View>
      {isPriceUpdating && (
        <View style={styles.statusItem}>
          <ActivityIndicator size="small" color="#2196f3" />
          <Text style={styles.statusText}>بروزرسانی...</Text>
        </View>
      )}
      <View style={styles.statusItem}>
        <Text style={styles.statusTextSmall}>{vpnStatusText}</Text>
      </View>
      {lastUpdateTime && <Text style={styles.statusTextSmall}>آخرین: {lastUpdateTime}</Text>}
    </View>
  );

  const renderAssetsContent = () => (
    <ScrollView
      onScroll={handleAssetsScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196f3']} tintColor="#2196f3" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💼 مدیریت دارایی</Text>
        <Text style={styles.subtitle}>{getJalaaliDate()}</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerBtn, styles.headerBtnPrices]} onPress={() => setPriceModalVisible(true)}>
            <Text style={styles.headerBtnText}>⚙️ قیمت‌ها</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, styles.headerBtnRefresh]} onPress={onRefresh}>
            <Text style={styles.headerBtnText}>🔄 بروزرسانی</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, styles.headerBtnAdd]} onPress={openAddModal}>
            <Text style={styles.headerBtnText}>➕ ثبت</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderStatusBar()}

      {/* Value Cards */}
      <View style={styles.valueCardsContainer}>
        <View style={styles.mainValueCard}>
          <View style={styles.valueCardHeader}>
            <Text style={styles.valueCardIcon}>💰</Text>
            <Text style={styles.valueCardTitle}>ارزش کل دارایی‌ها</Text>
          </View>
          <Text style={styles.mainValueText}>{formatTomans(totalValue)}</Text>
          <Text style={styles.mainValueUnit}>تومان</Text>
          {totalValue >= 1e9 && (
            <Text style={styles.compactValueText}>({formatCompactNumber(totalValue)})</Text>
          )}

          <View style={styles.usdSection}>
            <View style={styles.usdDivider} />
            {totalValueInUSD !== null ? (
              <>
                <Text style={styles.usdLabel}>معادل دلاری</Text>
                <Text style={styles.usdValue}>{formatUSD(totalValueInUSD)}</Text>
                <Text style={styles.usdRate}>(نرخ: {formatTomans(manualPrices.USD)} تومان)</Text>
              </>
            ) : (
              <Text style={styles.usdUnavailable}>⚠️ قیمت دلار تنظیم نشده</Text>
            )}
          </View>
        </View>

        <View style={styles.changeCard}>
          <Text style={styles.changeCardTitle}>📈 تغییر ۳۰ روزه</Text>
          <Text style={[styles.changeCardValue, (monthlyChange ?? 0) >= 0 ? styles.positive : styles.negative]}>
            {monthlyChange !== null ? `${monthlyChange >= 0 ? '+' : ''}${monthlyChange.toFixed(1)}%` : '—'}
          </Text>
          {totalValueInUSD !== null && monthlyChange !== null && (
            <Text style={styles.changeUsdText}>
              ≈ {monthlyChange >= 0 ? '+' : ''}{formatUSD(totalValueInUSD * monthlyChange / 100)}
            </Text>
          )}
        </View>
      </View>

      {/* Ownership Stats */}
      <View style={styles.ownershipCard}>
        <View style={styles.ownershipCardHeader}>
          <Text style={styles.ownershipCardTitle}>📊 تفکیک مالکیت</Text>
          <TouchableOpacity onPress={() => setShowOwnershipChart(!showOwnershipChart)}>
            <Text style={styles.toggleText}>{showOwnershipChart ? '📋 لیست' : '📊 نمودار'}</Text>
          </TouchableOpacity>
        </View>

        {showOwnershipChart ? (
          <View style={styles.ownershipChartContainer}>
            <View style={styles.ownershipBar}>
              {ownershipStats.personal.percent > 0 && (
                <View style={[styles.ownershipBarSegment, {
                  width: `${ownershipStats.personal.percent}%`, backgroundColor: '#2196f3',
                  borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
                  borderTopRightRadius: ownershipStats.corporate.percent === 0 ? 10 : 0,
                  borderBottomRightRadius: ownershipStats.corporate.percent === 0 ? 10 : 0,
                }]}>
                  {ownershipStats.personal.percent > 15 && <Text style={styles.barSegmentText}>{ownershipStats.personal.percent.toFixed(0)}%</Text>}
                </View>
              )}
              {ownershipStats.corporate.percent > 0 && (
                <View style={[styles.ownershipBarSegment, {
                  width: `${ownershipStats.corporate.percent}%`, backgroundColor: '#ff9800',
                  borderTopRightRadius: 10, borderBottomRightRadius: 10,
                  borderTopLeftRadius: ownershipStats.personal.percent === 0 ? 10 : 0,
                  borderBottomLeftRadius: ownershipStats.personal.percent === 0 ? 10 : 0,
                }]}>
                  {ownershipStats.corporate.percent > 15 && <Text style={styles.barSegmentText}>{ownershipStats.corporate.percent.toFixed(0)}%</Text>}
                </View>
              )}
            </View>
            <View style={styles.ownershipLegend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2196f3' }]} /><Text style={styles.legendText}>شخصی: {ownershipStats.personal.percent.toFixed(1)}%</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ff9800' }]} /><Text style={styles.legendText}>شرکتی: {ownershipStats.corporate.percent.toFixed(1)}%</Text></View>
            </View>
          </View>
        ) : (
          <View style={styles.ownershipDetails}>
            {[
              { key: 'personal', icon: '👤', label: 'شخصی', color: '#2196f3', data: ownershipStats.personal },
              { key: 'corporate', icon: '🏢', label: 'شرکتی', color: '#ff9800', data: ownershipStats.corporate },
            ].map((item, idx) => (
              <React.Fragment key={item.key}>
                {idx > 0 && <View style={styles.ownershipDivider} />}
                <View style={styles.ownershipDetailItem}>
                  <Text style={styles.ownershipDetailIcon}>{item.icon}</Text>
                  <View style={styles.ownershipDetailInfo}>
                    <Text style={styles.ownershipDetailLabel}>{item.label} ({item.data.count} قلم)</Text>
                    <Text style={[styles.ownershipDetailValue, { color: item.color }]}>
                      {formatTomans(item.data.value)} تومان
                    </Text>
                    {manualPrices.USD > 0 && (
                      <Text style={styles.ownershipDetailUsd}>≈ {formatUSD(item.data.value / manualPrices.USD)}</Text>
                    )}
                  </View>
                  <Text style={[styles.ownershipDetailPercent, { color: item.color }]}>{item.data.percent.toFixed(1)}%</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      {/* Search & Filter */}
      <View style={styles.searchFilterSection}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="جستجو در دارایی‌ها..."
            placeholderTextColor="#bbb"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.filterRow}>
          {[
            { id: 'all', label: 'همه', activeColor: '#2196f3' },
            { id: 'personal', label: '👤 شخصی', activeColor: '#2196f3' },
            { id: 'corporate', label: '🏢 شرکتی', activeColor: '#ff9800' },
          ].map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterChip, ownershipFilter === filter.id && [styles.filterChipActive, { backgroundColor: filter.activeColor }]]}
              onPress={() => setOwnershipFilter(filter.id)}
            >
              <Text style={[styles.filterChipText, ownershipFilter === filter.id && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Asset List Header */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          📋 دارایی‌ها
          {ownershipFilter !== 'all' && ` (${ownershipFilter === 'personal' ? 'شخصی' : 'شرکتی'})`}
          {searchQuery.length > 0 && ` — "${searchQuery}"`}
        </Text>
        <Text style={styles.listCount}>{filteredAssets.length} مورد</Text>
      </View>

      {/* Asset List */}
      {filteredAssets.length > 0 ? (
        filteredAssets.map(asset => {
          const currentPrice = getCurrentPrice(asset);
          const unitPrice = currentPrice;
          return (
            <AssetItem
              key={asset.id}
              asset={asset}
              currentPrice={currentPrice}
              unitPrice={unitPrice}
              profitLoss={getProfitLoss(asset)}
              onPress={() => openEditModal(asset)}
              onDelete={() => deleteAsset(asset.id, asset.detail || asset.type)}
            />
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '📭'}</Text>
          <Text style={styles.emptyTitle}>
            {searchQuery ? `نتیجه‌ای برای "${searchQuery}" یافت نشد` : 'هیچ دارایی یافت نشد'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'عبارت جستجو را تغییر دهید' : 
              ownershipFilter !== 'all' ? 'فیلتر را تغییر دهید یا دارایی جدید ثبت کنید' : 'روی دکمه "➕ ثبت" کلیک کنید'}
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderPortfolioContent = () => {
    const { portfolio, total } = portfolioData;
    return (
      <ScrollView style={styles.portfolioContainer}>
        <View style={styles.portfolioSection}>
          <Text style={styles.portfolioSectionTitle}>📊 تفکیک مالکیت</Text>
          {[
            { key: 'personal', icon: '👤', label: 'شخصی', color: '#2196f3', data: ownershipStats.personal },
            { key: 'corporate', icon: '🏢', label: 'شرکتی', color: '#ff9800', data: ownershipStats.corporate },
          ].map(item => (
            <View key={item.key} style={styles.portfolioOwnershipItem}>
              <View style={styles.portfolioOwnershipHeader}>
                <Text style={styles.portfolioOwnershipLabel}>{item.icon} {item.label}</Text>
                <Text style={[styles.portfolioOwnershipPercent, { color: item.color }]}>{item.data.percent.toFixed(1)}%</Text>
              </View>
              <View style={styles.portfolioOwnershipBar}>
                <View style={[styles.portfolioOwnershipBarFill, { width: `${item.data.percent}%`, backgroundColor: item.color }]} />
              </View>
              <View style={styles.portfolioOwnershipValues}>
                <Text style={styles.portfolioOwnershipValue}>{formatTomans(item.data.value)} تومان</Text>
                {manualPrices.USD > 0 && <Text style={styles.portfolioOwnershipUsd}>≈ {formatUSD(item.data.value / manualPrices.USD)}</Text>}
              </View>
            </View>
          ))}
          <View style={styles.portfolioTotalRow}>
            <Text style={styles.portfolioTotalLabel}>مجموع کل:</Text>
            <View>
              <Text style={styles.portfolioTotalValue}>{formatTomans(ownershipStats.total)} تومان</Text>
              {manualPrices.USD > 0 && <Text style={styles.portfolioTotalUsd}>≈ {formatUSD(ownershipStats.total / manualPrices.USD)}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.portfolioSection}>
          <Text style={styles.portfolioSectionTitle}>📈 تحلیل پرتفوی</Text>
          {portfolio.length > 0 ? (
            <>
              <View style={styles.portfolioTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 2.5 }]}>دارایی</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.2 }]}>مقدار</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>سهم</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 2 }]}>ارزش</Text>
                </View>
                {portfolio.map((item, index) => {
                  let qtyDisplay = '—';
                  if (item.type === 'ارز') qtyDisplay = `${item.quantity} واحد`;
                  else if (item.type === 'سکه') qtyDisplay = `${item.quantity} عدد`;
                  else if (item.type === 'طلا') qtyDisplay = `${item.quantity} گرم`;
                  else if (item.type === 'اوراق بهادار و سهام') qtyDisplay = `${item.quantity} سهم`;
                  return (
                    <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                      <Text style={[styles.tableCell, { flex: 2.5, fontWeight: '600', color: getColorForType(item.type) }]}>
                        {getIconForType(item.type)} {item.detail}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1.2, fontSize: 11 }]}>{qtyDisplay}</Text>
                      <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold', color: getColorForType(item.type) }]}>{item.percent.toFixed(1)}%</Text>
                      <View style={{ flex: 2 }}>
                        <Text style={[styles.tableCell, { fontSize: 12 }]}>{formatTomans(item.value)}</Text>
                        {manualPrices.USD > 0 && <Text style={[styles.tableCell, { fontSize: 10, color: '#999' }]}>{formatUSD(item.value / manualPrices.USD)}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.chartSection}>
                <Text style={styles.chartSectionTitle}>📊 نمودار توزیع</Text>
                {portfolio.map((item, index) => (
                  <View key={index} style={styles.chartItem}>
                    <View style={styles.chartItemHeader}>
                      <Text style={styles.chartItemLabel}>{getIconForType(item.type)} {item.detail}</Text>
                      <Text style={[styles.chartItemPercent, { color: getColorForType(item.type) }]}>{item.percent.toFixed(1)}%</Text>
                    </View>
                    <View style={styles.chartBar}>
                      <View style={[styles.chartBarFill, { width: `${Math.max(item.percent, 1)}%`, backgroundColor: getColorForType(item.type) }]} />
                    </View>
                    <View style={styles.chartItemValues}>
                      <Text style={styles.chartItemValue}>{formatTomans(item.value)} تومان</Text>
                      {manualPrices.USD > 0 && <Text style={styles.chartItemUsd}>{formatUSD(item.value / manualPrices.USD)}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyPortfolio}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>پرتفوی خالی است</Text>
              <Text style={styles.emptySubtitle}>ابتدا دارایی ثبت کنید</Text>
            </View>
          )}
        </View>

        <View style={styles.tipsSection}>
          <Text style={styles.tipsSectionTitle}>💡 نکات مدیریت سرمایه</Text>
          {[
            '📌 تنوع‌بخشید: دارایی‌ها را بین چند دسته پخش کنید',
            '📌 بروزرسانی منظم: قیمت‌ها را هر هفته به‌روز کنید',
            '📌 ریسک‌پذیری: بیش از ۳۰٪ را در یک دارایی متمرکز نکنید',
            '📌 سود مرکب: سود را دوباره سرمایه‌گذاری کنید',
          ].map((tip, i) => <Text key={i} style={styles.tipText}>{tip}</Text>)}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // ===== Loading Screen =====
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <Text style={styles.loadingIcon}>💼</Text>
        <ActivityIndicator size="large" color="#2196f3" style={{ marginTop: 16 }} />
        <Text style={styles.loadingText}>در حال بارگذاری...</Text>
      </SafeAreaView>
    );
  }

  // ===== Main Return =====
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      {/* Sticky Header */}
      <StickyHeader totalValue={totalValue} totalValueInUSD={totalValueInUSD} isVisible={showStickyHeader && activeTab === 'assets'} />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { id: 'assets', label: '📋 دارایی‌ها', page: 0 },
          { id: 'portfolio', label: '📊 ترکیب دارایی', page: 1 },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => { setActiveTab(tab.id); scrollToPage(tab.page); }}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pages */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
      >
        <View style={{ width }}>{renderAssetsContent()}</View>
        <View style={{ width }}>{renderPortfolioContent()}</View>
      </ScrollView>

      {/* Asset Modal - واحد برای هر دو حالت add و edit */}
      <Modal animationType="slide" transparent={true} visible={assetModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {assetModalMode === 'edit' ? '✏️ ویرایش دارایی' : '✨ افزودن دارایی جدید'}
              </Text>
              <TouchableOpacity onPress={() => setAssetModalVisible(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
              <Text style={styles.fieldLabel}>📂 نوع دارایی</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled={true}>
                {ASSET_TYPES.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, selectedAssetType === type && [styles.typeChipActive, { backgroundColor: getColorForType(type) }]]}
                    onPress={() => setSelectedAssetType(type)}
                  >
                    <Text style={styles.typeChipIcon}>{getIconForType(type)}</Text>
                    <Text style={[styles.typeChipText, selectedAssetType === type && styles.typeChipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.formDivider} />
              {renderAssetForm()}
              {renderOwnershipSelector()}

              <Text style={styles.fieldLabel}>📅 تاریخ خرید (شمسی)</Text>
              <JalaaliDatePicker
                value={formData.buyDateJalaali || getTodayJalaali()}
                onChange={(date) => setFormData(prev => ({ ...prev, buyDateJalaali: date }))}
              />

              <Text style={styles.fieldLabel}>📝 توضیحات (اختیاری)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="توضیحات اضافی..."
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={3}
                value={formData.description}
                onChangeText={text => setFormData(prev => ({ ...prev, description: text }))}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAssetModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => saveAsset({
                    type: selectedAssetType,
                    detail: formData.detail || '',
                    quantity: formData.quantity || 1,
                    buyPriceTotal: formData.buyPriceTotal || 0,
                    buyDateJalaali: formData.buyDateJalaali || getTodayJalaali(),
                    description: formData.description || '',
                    ownership: formData.ownership || 'personal',
                  })}
                >
                  <Text style={styles.submitBtnText}>
                    {assetModalMode === 'edit' ? '✓ ذخیره تغییرات' : '✓ افزودن'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Price Settings Modal */}
      <Modal animationType="slide" transparent={true} visible={priceModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: height * 0.92 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>⚙️ تنظیم قیمت‌ها</Text>
                <Text style={styles.modalSubtitle}>قیمت‌ها به تومان</Text>
              </View>
              <TouchableOpacity onPress={() => setPriceModalVisible(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.autoUpdateBtn, isPriceUpdating && styles.autoUpdateBtnDisabled]}
              onPress={() => fetchOnlinePrices(true)}
              disabled={isPriceUpdating}
            >
              {isPriceUpdating ? (
                <View style={styles.autoUpdateBtnContent}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.autoUpdateBtnText}> در حال دریافت...</Text>
                </View>
              ) : (
                <Text style={styles.autoUpdateBtnText}>🔄 دریافت خودکار از اینترنت</Text>
              )}
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
              <View style={styles.priceSection}>
                <Text style={styles.priceSectionTitle}>💱 ارزهای اصلی</Text>
                <View style={styles.priceGrid}>
                  {MAIN_CURRENCIES.map(code => (
                    <PriceCard key={code} label={`${getCurrencyFlag(code)} ${getCurrencyName(code)} (${code})`} priceKey={code} value={manualPrices[code]} onUpdate={updateManualPrice} />
                  ))}
                </View>
              </View>

              <View style={styles.priceSection}>
                <Text style={styles.priceSectionTitle}>🌍 سایر ارزها</Text>
                <View style={styles.priceGrid}>
                  {OTHER_CURRENCIES.map(code => (
                    <PriceCard key={code} label={`${getCurrencyFlag(code)} ${getCurrencyName(code)} (${code})`} priceKey={code} value={manualPrices[code]} onUpdate={updateManualPrice} />
                  ))}
                </View>
              </View>

              <View style={styles.priceSection}>
                <Text style={styles.priceSectionTitle}>🥇 طلا و سکه</Text>
                <View style={styles.priceGrid}>
                  {[
                    { label: '🥇 طلای ۱۸ عیار (گرم)', key: 'GOLD_18_PER_GRAM' },
                    { label: '🥇 طلای ۲۴ عیار (گرم)', key: 'GOLD_24_PER_GRAM' },
                    { label: '🪙 سکه امامی', key: 'COIN_EMAMI' },
                    { label: '🪙 بهار آزادی', key: 'COIN_BAHAR' },
                    { label: '🪙 نیم سکه', key: 'COIN_NIM' },
                    { label: '🪙 ربع سکه', key: 'COIN_ROB' },
                    { label: '🪙 سکه گرمی', key: 'COIN_GERAMI' },
                  ].map(item => (
                    <PriceCard key={item.key} label={item.label} priceKey={item.key} value={manualPrices[item.key]} onUpdate={updateManualPrice} />
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.priceSaveBtn} onPress={() => setPriceModalVisible(false)}>
                <Text style={styles.priceSaveBtnText}>✓ ذخیره و بستن</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  loadingIcon: { fontSize: 48 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },

  // Sticky Header
  stickyHeader: {
    backgroundColor: '#ffffffee',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyHeaderText: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  stickyHeaderUsd: { fontSize: 13, color: '#0984e3', fontWeight: '600' },

  // Tab Bar
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0, borderBottomWidth: 1, borderBottomColor: '#e8e8e8', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#2196f3' },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  activeTabText: { color: '#2196f3', fontWeight: 'bold' },

  // Header
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e8e8e8' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 4, marginBottom: 14 },
  headerActions: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  headerBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 25, minWidth: 80, alignItems: 'center' },
  headerBtnPrices: { backgroundColor: '#6c5ce7' },
  headerBtnRefresh: { backgroundColor: '#00b894' },
  headerBtnAdd: { backgroundColor: '#e17055' },
  headerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Status Bar
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8e8e8', gap: 12, flexWrap: 'wrap' },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  online: { backgroundColor: '#00b894' },
  offline: { backgroundColor: '#d63031' },
  statusText: { fontSize: 12, color: '#666' },
  statusTextSmall: { fontSize: 10, color: '#999' },

  // Value Cards
  valueCardsContainer: { padding: 16, gap: 12 },
  mainValueCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  valueCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  valueCardIcon: { fontSize: 20 },
  valueCardTitle: { fontSize: 14, color: '#888', fontWeight: '500' },
  mainValueText: { fontSize: 32, fontWeight: '800', color: '#1a1a2e', letterSpacing: 0.5 },
  mainValueUnit: { fontSize: 14, color: '#888', marginTop: 2 },
  compactValueText: { fontSize: 13, color: '#999', marginTop: 4, fontStyle: 'italic' },

  usdSection: { width: '100%', alignItems: 'center', marginTop: 16 },
  usdDivider: { width: '60%', height: 1, backgroundColor: '#e8e8e8', marginBottom: 14 },
  usdLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  usdValue: { fontSize: 24, fontWeight: 'bold', color: '#0984e3', letterSpacing: 0.5 },
  usdRate: { fontSize: 11, color: '#bbb', marginTop: 4 },
  usdUnavailable: { fontSize: 12, color: '#fdcb6e', textAlign: 'center' },

  changeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  changeCardTitle: { fontSize: 13, color: '#888', marginBottom: 8 },
  changeCardValue: { fontSize: 28, fontWeight: 'bold' },
  changeUsdText: { fontSize: 13, color: '#666', marginTop: 6 },
  positive: { color: '#00b894' },
  negative: { color: '#d63031' },

  // Ownership Card
  ownershipCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  ownershipCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  ownershipCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  toggleText: { fontSize: 12, color: '#0984e3', fontWeight: '600' },
  ownershipChartContainer: { alignItems: 'center' },
  ownershipBar: { flexDirection: 'row', height: 36, width: '100%', borderRadius: 10, overflow: 'hidden', backgroundColor: '#e8e8e8', marginBottom: 14 },
  ownershipBarSegment: { height: 36, justifyContent: 'center', alignItems: 'center' },
  barSegmentText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  ownershipLegend: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 13, color: '#555' },
  ownershipDetails: {},
  ownershipDetailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  ownershipDetailIcon: { fontSize: 28, width: 40 },
  ownershipDetailInfo: { flex: 1 },
  ownershipDetailLabel: { fontSize: 13, color: '#888' },
  ownershipDetailValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  ownershipDetailUsd: { fontSize: 12, color: '#999', marginTop: 2 },
  ownershipDetailPercent: { fontSize: 18, fontWeight: 'bold' },
  ownershipDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },

  // Search & Filter
  searchFilterSection: { paddingHorizontal: 16, marginBottom: 8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e8e8e8' },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#2d3436' },
  searchClear: { padding: 4, marginLeft: 4 },
  searchClearText: { fontSize: 16, color: '#999', fontWeight: 'bold' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { flex: 1, paddingVertical: 10, borderRadius: 25, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  filterChipActive: { borderColor: 'transparent' },
  filterChipText: { fontSize: 13, color: '#666', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: 'bold' },

  // Asset List
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  listTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e', flex: 1 },
  listCount: { fontSize: 13, color: '#888', backgroundColor: '#e8e8e8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  
  assetItemContainer: { marginHorizontal: 16, marginBottom: 10 },
  assetItem: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  assetRow: { flexDirection: 'row', alignItems: 'center' },
  assetIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative' },
  assetIconText: { fontSize: 24 },
  ownershipBadge: { position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  ownershipBadgeText: { fontSize: 10 },
  assetInfo: { flex: 1, marginRight: 8 },
  assetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  assetType: { fontSize: 14, fontWeight: 'bold' },
  ownershipTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  personalTag: { backgroundColor: '#dfe6e9' },
  corporateTag: { backgroundColor: '#ffeaa7' },
  ownershipTagText: { fontSize: 10, fontWeight: '600' },
  personalTagText: { color: '#0984e3' },
  corporateTagText: { color: '#e17055' },
  assetDetail: { fontSize: 15, fontWeight: '600', color: '#2d3436', marginBottom: 4 },
  assetMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  assetMetaText: { fontSize: 11, color: '#999' },
  assetUnitPrice: { fontSize: 11, color: '#0984e3', marginTop: 2 },
  assetDesc: { fontSize: 11, color: '#b2bec3', marginTop: 2 },
  assetValues: { alignItems: 'flex-end', minWidth: 90 },
  assetCurrentValue: { fontSize: 15, fontWeight: 'bold', color: '#2d3436' },
  assetValueLabel: { fontSize: 10, color: '#b2bec3', marginBottom: 4 },
  profitBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 2 },
  profitBadgeGreen: { backgroundColor: '#e8f5e9' },
  profitBadgeRed: { backgroundColor: '#ffebee' },
  profitBadgeText: { fontSize: 11, fontWeight: 'bold' },
  profitTextGreen: { color: '#00b894' },
  profitTextRed: { color: '#d63031' },
  profitAmount: { fontSize: 10, fontWeight: '500' },
  
  deleteButton: { position: 'absolute', top: 8, left: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffebee', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1 },
  deleteButtonText: { fontSize: 14 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#636e72', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#b2bec3', textAlign: 'center', paddingHorizontal: 40 },

  // Portfolio
  portfolioContainer: { padding: 16 },
  portfolioSection: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  portfolioSectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16, textAlign: 'center' },
  portfolioOwnershipItem: { marginBottom: 16 },
  portfolioOwnershipHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  portfolioOwnershipLabel: { fontSize: 14, fontWeight: '600', color: '#2d3436' },
  portfolioOwnershipPercent: { fontSize: 14, fontWeight: 'bold' },
  portfolioOwnershipBar: { height: 20, backgroundColor: '#f0f0f0', borderRadius: 10, overflow: 'hidden', marginBottom: 6 },
  portfolioOwnershipBarFill: { height: 20, borderRadius: 10 },
  portfolioOwnershipValues: { flexDirection: 'row', justifyContent: 'space-between' },
  portfolioOwnershipValue: { fontSize: 13, color: '#636e72' },
  portfolioOwnershipUsd: { fontSize: 12, color: '#999' },
  portfolioTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 4 },
  portfolioTotalLabel: { fontSize: 14, fontWeight: 'bold', color: '#2d3436' },
  portfolioTotalValue: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'right' },
  portfolioTotalUsd: { fontSize: 12, color: '#0984e3', textAlign: 'right', marginTop: 2 },

  // Table
  portfolioTable: { marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8f9fa', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4 },
  tableHeaderCell: { fontWeight: 'bold', color: '#636e72', fontSize: 12 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center' },
  tableRowEven: { backgroundColor: '#fafafa' },
  tableRowOdd: { backgroundColor: '#fff' },
  tableCell: { fontSize: 12, color: '#2d3436' },

  // Chart
  chartSection: { marginTop: 8 },
  chartSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#636e72', marginBottom: 16, textAlign: 'center' },
  chartItem: { marginBottom: 14 },
  chartItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartItemLabel: { fontSize: 13, fontWeight: '600', color: '#2d3436' },
  chartItemPercent: { fontSize: 13, fontWeight: 'bold' },
  chartBar: { height: 22, backgroundColor: '#f0f0f0', borderRadius: 11, overflow: 'hidden', marginBottom: 4 },
  chartBarFill: { height: 22, borderRadius: 11 },
  chartItemValues: { flexDirection: 'row', justifyContent: 'space-between' },
  chartItemValue: { fontSize: 11, color: '#636e72' },
  chartItemUsd: { fontSize: 11, color: '#0984e3' },
  emptyPortfolio: { alignItems: 'center', paddingVertical: 40 },

  // Tips
  tipsSection: { backgroundColor: '#dfe6e9', borderRadius: 16, padding: 18, marginBottom: 16 },
  tipsSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#2d3436', marginBottom: 12, textAlign: 'center' },
  tipText: { fontSize: 13, color: '#636e72', marginBottom: 10, lineHeight: 22 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: width * 0.92, maxHeight: height * 0.88 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  modalSubtitle: { fontSize: 12, color: '#999', marginTop: 4 },
  modalCloseButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { fontSize: 18, color: '#636e72', fontWeight: 'bold' },

  // Form
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#2d3436', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: '#e8e8e8', borderRadius: 14, padding: 14, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 4, color: '#2d3436' },
  textArea: { textAlignVertical: 'top', minHeight: 80 },
  formDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },

  // Chips
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 25, backgroundColor: '#f0f0f0', marginRight: 8, gap: 4 },
  typeChipActive: { backgroundColor: '#2196f3' },
  typeChipIcon: { fontSize: 16 },
  typeChipText: { fontSize: 13, color: '#636e72', fontWeight: '500' },
  typeChipTextActive: { color: '#fff', fontWeight: 'bold' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, backgroundColor: '#f0f0f0' },
  chipWide: { flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: '#2196f3' },
  chipText: { fontSize: 13, color: '#636e72', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  currencyScrollView: { marginBottom: 8 },
  currencyChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8, gap: 4 },
  currencyChipActive: { backgroundColor: '#2196f3' },
  currencyChipFlag: { fontSize: 16 },
  currencyChipText: { fontSize: 13, color: '#636e72', fontWeight: '500' },
  currencyChipTextActive: { color: '#fff', fontWeight: 'bold' },
  selectedCurrencyName: { fontSize: 13, color: '#0984e3', fontWeight: '500', marginBottom: 4, marginTop: 4 },

  // Ownership Selector
  ownershipSelector: { marginTop: 8 },
  ownershipOptions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  ownershipOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f8f9fa', borderWidth: 2, borderColor: '#e8e8e8' },
  ownershipOptionActive: { backgroundColor: '#e8f4fd' },
  ownershipOptionIcon: { fontSize: 22 },
  ownershipOptionText: { fontSize: 14, color: '#636e72', fontWeight: '500' },

  // Date Picker (Jalaali)
  dateButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e8e8e8', borderRadius: 14, padding: 14, backgroundColor: '#fafafa', marginBottom: 4, gap: 8 },
  dateButtonIcon: { fontSize: 16 },
  dateButtonText: { fontSize: 15, color: '#2d3436' },
  
  jalaaliPickerContainer: { backgroundColor: '#f8f9fa', borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  jalaaliPickerTitle: { fontSize: 15, fontWeight: 'bold', color: '#2d3436', textAlign: 'center', marginBottom: 12 },
  jalaaliPickerRow: { flexDirection: 'row', gap: 8 },
  jalaaliPickerColumn: { flex: 1 },
  jalaaliPickerLabel: { fontSize: 12, fontWeight: '600', color: '#888', textAlign: 'center', marginBottom: 6 },
  jalaaliPickerScroll: { maxHeight: 150, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e8e8' },
  jalaaliPickerItem: { paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  jalaaliPickerItemActive: { backgroundColor: '#2196f3', borderRadius: 8 },
  jalaaliPickerItemText: { fontSize: 14, color: '#2d3436' },
  jalaaliPickerItemTextActive: { color: '#fff', fontWeight: 'bold' },
  jalaaliPickerActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  jalaaliPickerCancel: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#e8e8e8', alignItems: 'center' },
  jalaaliPickerCancelText: { color: '#666', fontWeight: '600' },
  jalaaliPickerConfirm: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#2196f3', alignItems: 'center' },
  jalaaliPickerConfirmText: { color: '#fff', fontWeight: 'bold' },

  // Modal Actions
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 10 },
  cancelBtn: { flex: 1, padding: 15, borderRadius: 14, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelBtnText: { color: '#636e72', fontWeight: '600', fontSize: 15 },
  submitBtn: { flex: 1, padding: 15, borderRadius: 14, backgroundColor: '#0984e3', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // Price Modal
  autoUpdateBtn: { backgroundColor: '#00b894', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
  autoUpdateBtnDisabled: { backgroundColor: '#81c784' },
  autoUpdateBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  autoUpdateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  priceSection: { marginBottom: 20 },
  priceSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  priceCard: { width: '48%', backgroundColor: '#f8f9fa', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e8e8e8' },
  priceCardLabel: { fontSize: 12, fontWeight: '600', color: '#636e72', marginBottom: 8 },
  priceCardInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fff', color: '#2d3436' },
  priceSaveBtn: { backgroundColor: '#0984e3', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  priceSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});