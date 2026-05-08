import { WebView } from 'react-native-webview';
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import ExpoVpnChecker from 'expo-vpn-checker';

const { width, height } = Dimensions.get('window');

// ==================== CONSTANTS ====================
const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'AED', 'GBP', 'SEK', 'DKK', 'JPY', 'MYR', 'KWD',
  'SYP', 'RUB', 'SGD', 'IQD', 'AFN', 'AZN', 'AUD', 'CAD', 'CNY',
  'CHF', 'TRY', 'NOK', 'HKD'
];

const COIN_TYPES = ['تمام بهار آزادی', 'نیم سکه', 'ربع سکه', 'سکه گرمی'];
const ASSET_TYPES = ['حساب بانکی', 'پول نقد', 'ارز', 'سکه', 'طلا', 'اوراق بهادار و سهام', 'سایر'];
const COLORS = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#ffc107', '#f44336', '#607d8b'];
const OWNERSHIP_TYPES = [
  { id: 'personal', label: '👤 شخصی', color: '#2196f3' },
  { id: 'corporate', label: '🏢 شرکتی', color: '#ff9800' }
];

export default function App() {
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [monthlyChange, setMonthlyChange] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [activeTab, setActiveTab] = useState('assets');
  const scrollViewRef = useRef(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedAssetType, setSelectedAssetType] = useState('حساب بانکی');
  const [formData, setFormData] = useState({ quantity: 1, ownership: 'personal' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  
  const [manualPrices, setManualPrices] = useState({
    USD: 0, GOLD_18_PER_GRAM: 0, COIN_EMAMI: 0, COIN_NIM: 0, COIN_ROB: 0, COIN_GERAMI: 0,
  });
  const [exchangeRates, setExchangeRates] = useState({});
  const [snapshots, setSnapshots] = useState([]);
  
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [showOwnershipChart, setShowOwnershipChart] = useState(false);
  
  // ==================== VPN State ====================
  const [isVpnActive, setIsVpnActive] = useState(false);
  const [vpnStatusText, setVpnStatusText] = useState('در حال بررسی...');

  // ==================== توابع دریافت قیمت خودکار بنبست====================
  const fetchOnlinePrices = async () => {
  try {
    setIsOnline(true);
    console.log("🔄 دریافت قیمت‌ها از GitHub...");
    
    // آدرس مستقیم فایل prices.json در گیت‌هاب (RAW)
    const response = await fetch('https://raw.githubusercontent.com/nvdtairbus-ctrl/AssetManager/main/prices.json');
    const data = await response.json();

    if (data.usd && data.gold) {
      const newPrices = {
        USD: data.usd,
        EUR: data.eur,
        GBP: data.gbp,
        CHF: data.chf,
        CAD: data.cad,
        AUD: data.aud,
        SEK: data.sek,
        NOK: data.nok,
        RUB: data.rub,
        THB: data.thb,
        SGD: data.sgd,
        HKD: data.hkd,
        AZN: data.azn,
        AMD: data.amd,
        DKK: data.dkk,
        AED: data.aed,
        JPY: data.jpy,
        TRY: data.try,
        CNY: data.cny,
        SAR: data.sar,
        INR: data.inr,
        MYR: data.myr,
        AFN: data.afn,
        KWD: data.kwd,
        IQD: data.iqd,
        BHD: data.bhd,
        OMR: data.omr,
        QAR: data.qar,
        GOLD_18_PER_GRAM: data.gold,
        COIN_EMAMI: data.emami_coin,
        COIN_NIM: data.nim_coin,
        COIN_ROB: data.rob_coin,
        COIN_GERAMI: data.gold,
      };

      setManualPrices(newPrices);
      await AsyncStorage.setItem('manualPrices', JSON.stringify(newPrices));
      setIsOnline(true);
      
      // نمایش پیام با تاریخ آخرین بروزرسانی
      const lastUpdate = data.last_update ? new Date(data.last_update).toLocaleString('fa-IR') : 'نامشخص';
      Alert.alert('✅ موفقیت', `قیمت‌ها از GitHub دریافت شدند.\nآخرین بروزرسانی: ${lastUpdate}`);
      return newPrices;
    } else {
      throw new Error('داده‌های دریافتی کامل نیست');
    }
  } catch (error) {
    console.log("❌ خطا:", error);
    setIsOnline(false);
    Alert.alert('⚠️ خطا', 'دریافت خودکار قیمت‌ها ممکن نشد.\n\nلطفاً اینترنت خود را بررسی کنید.');
    return null;
  }
};

  // ==================== توابع کمکی ====================
  const loadAllData = async () => {
    try {
      const savedAssets = await AsyncStorage.getItem('assets');
      if (savedAssets) setAssets(JSON.parse(savedAssets));
      else loadSampleAssets();
      
      const savedPrices = await AsyncStorage.getItem('manualPrices');
      if (savedPrices) setManualPrices(JSON.parse(savedPrices));
      else await fetchOnlinePrices();
      
      const savedRates = await AsyncStorage.getItem('exchangeRates');
      if (savedRates) setExchangeRates(JSON.parse(savedRates));
      
      const savedSnapshots = await AsyncStorage.getItem('snapshots');
      if (savedSnapshots) setSnapshots(JSON.parse(savedSnapshots));
      
      const savedUpdateTime = await AsyncStorage.getItem('lastUpdateTime');
      if (savedUpdateTime) setLastUpdateTime(savedUpdateTime);
    } catch (error) { console.error('خطا در بارگذاری:', error); }
  };

  const loadSampleAssets = () => {
    const sample = [
      { id: 1, type: 'حساب بانکی', detail: 'ملت', quantity: 1, buyPriceTotal: 50000000, buyDate: '2024-01-15', description: 'حساب جاری', ownership: 'personal' },
      { id: 2, type: 'پول نقد', detail: 'صندوق منزل', quantity: 1, buyPriceTotal: 25000000, buyDate: '2024-01-20', description: '', ownership: 'personal' },
      { id: 3, type: 'ارز', detail: 'USD', quantity: 500, buyPriceTotal: 40000000, buyDate: '2024-01-10', description: 'برای سفر', ownership: 'personal' },
      { id: 4, type: 'ارز', detail: 'EUR', quantity: 300, buyPriceTotal: 30000000, buyDate: '2024-01-10', description: 'برای سفر', ownership: 'personal' },
      { id: 5, type: 'طلا', detail: '18 عیار', quantity: 10, buyPriceTotal: 10000000, buyDate: '2024-01-05', description: 'انگشتر', ownership: 'personal' },
      { id: 6, type: 'سکه', detail: 'تمام بهار آزادی', quantity: 1, buyPriceTotal: 35000000, buyDate: '2024-01-12', description: '', ownership: 'corporate' },
      { id: 7, type: 'سکه', detail: 'نیم سکه', quantity: 2, buyPriceTotal: 40000000, buyDate: '2024-01-12', description: '', ownership: 'corporate' },
    ];
    setAssets(sample);
    AsyncStorage.setItem('assets', JSON.stringify(sample));
  };

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      const filteredRates = {};
      SUPPORTED_CURRENCIES.forEach(currency => { if (data.rates[currency]) filteredRates[currency] = data.rates[currency]; });
      setExchangeRates(filteredRates);
      await AsyncStorage.setItem('exchangeRates', JSON.stringify(filteredRates));
      await AsyncStorage.setItem('lastUpdateTime', new Date().toLocaleString());
      setLastUpdateTime(new Date().toLocaleString());
      setIsOnline(true);
    } catch (error) { 
      console.log('خطا در دریافت نرخ ارز، استفاده از کش'); 
      setIsOnline(false); 
    }
  };

  const getCurrentPrice = (asset) => {
    const type = asset.type, detail = asset.detail;
    if (type === 'ارز') { 
      if (!manualPrices.USD || !exchangeRates[detail]) return null; 
      return manualPrices.USD / exchangeRates[detail]; 
    }
    if (type === 'سکه') { 
      const coinMap = { 'تمام بهار آزادی': manualPrices.COIN_EMAMI, 'نیم سکه': manualPrices.COIN_NIM, 'ربع سکه': manualPrices.COIN_ROB, 'سکه گرمی': manualPrices.COIN_GERAMI }; 
      return coinMap[detail] || null; 
    }
    if (type === 'طلا') { 
      if (!manualPrices.GOLD_18_PER_GRAM) return null; 
      if (detail === '18 عیار') return manualPrices.GOLD_18_PER_GRAM; 
      if (detail === '24 عیار') return manualPrices.GOLD_18_PER_GRAM * (24 / 18); 
      return null; 
    }
    if (type === 'حساب بانکی' || type === 'پول نقد' || type === 'سایر') return asset.buyPriceTotal / asset.quantity;
    if (type === 'اوراق بهادار و سهام') return null;
    return null;
  };

  const calculateTotalValue = () => {
    let total = 0;
    assets.forEach(asset => { const price = getCurrentPrice(asset); if (price) total += price * asset.quantity; else total += asset.buyPriceTotal || 0; });
    setTotalValue(total);
    
    const today = new Date().toISOString().split('T')[0];
    const newSnapshots = [...snapshots];
    const existingIndex = newSnapshots.findIndex(s => s.date === today);
    if (existingIndex >= 0) newSnapshots[existingIndex].value = total;
    else newSnapshots.push({ date: today, value: total });
    const last30Days = newSnapshots.slice(-30);
    setSnapshots(last30Days);
    AsyncStorage.setItem('snapshots', JSON.stringify(last30Days));
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const oldSnapshot = last30Days.find(s => s.date <= thirtyDaysAgoStr);
    if (oldSnapshot && oldSnapshot.value > 0) { 
      const change = ((total - oldSnapshot.value) / oldSnapshot.value) * 100; 
      setMonthlyChange(change); 
    }
  };

  const getOwnershipStats = () => {
    let personalValue = 0, corporateValue = 0, personalCount = 0, corporateCount = 0;
    
    assets.forEach(asset => {
      const price = getCurrentPrice(asset);
      const value = price ? price * asset.quantity : asset.buyPriceTotal || 0;
      
      if (asset.ownership === 'personal') {
        personalValue += value;
        personalCount++;
      } else if (asset.ownership === 'corporate') {
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
      total
    };
  };

  const saveAsset = async (asset, isEdit = false) => {
    if (!asset.detail && asset.type !== 'ارز') { 
      Alert.alert('خطا', 'لطفاً نام دارایی را وارد کنید'); 
      return false; 
    }
    
    const assetWithOwnership = {
      ...asset,
      ownership: asset.ownership || 'personal'
    };
    
    let newAssets;
    if (isEdit && selectedAsset) {
      newAssets = assets.map(a => a.id === selectedAsset.id ? { ...assetWithOwnership, id: selectedAsset.id } : a);
    } else {
      newAssets = [...assets, { ...assetWithOwnership, id: Date.now() }];
    }
    
    setAssets(newAssets);
    await AsyncStorage.setItem('assets', JSON.stringify(newAssets));
    setModalVisible(false); 
    setEditModalVisible(false); 
    setSelectedAsset(null); 
    setFormData({ quantity: 1, ownership: 'personal' });
    return true;
  };

  const deleteAsset = (id) => {
    Alert.alert('حذف دارایی', 'آیا از حذف این دارایی اطمینان دارید؟', [
      { text: 'انصراف', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => { 
        const newAssets = assets.filter(a => a.id !== id); 
        setAssets(newAssets); 
        await AsyncStorage.setItem('assets', JSON.stringify(newAssets)); 
      } },
    ]);
  };

  const updateManualPrice = async (key, value) => { 
    const numValue = parseInt(value) || 0; 
    const newPrices = { ...manualPrices, [key]: numValue }; 
    setManualPrices(newPrices); 
    await AsyncStorage.setItem('manualPrices', JSON.stringify(newPrices)); 
  };
  
  const onRefresh = async () => { 
    setRefreshing(true); 
    await fetchExchangeRates(); 
    await fetchOnlinePrices(); 
    calculateTotalValue(); 
    setRefreshing(false); 
  };
  
  const formatTomans = (num) => {
    if (num === undefined || num === null) return 'N/A';
    const rounded = Math.round(num);
    return rounded.toLocaleString();
  };
  
  const getProfitLoss = (asset) => { 
    const currentPrice = getCurrentPrice(asset); 
    if (!currentPrice || !asset.buyPriceTotal) return null; 
    const currentValue = currentPrice * asset.quantity; 
    const profit = currentValue - asset.buyPriceTotal; 
    const profitPercent = asset.buyPriceTotal > 0 ? (profit / asset.buyPriceTotal) * 100 : 0; 
    return { profit, profitPercent };
  };

  const getGroupedPortfolioData = () => {
    const itemTotals = {};
    let total = 0;
    
    assets.forEach(asset => {
      const price = getCurrentPrice(asset);
      const value = price ? price * asset.quantity : asset.buyPriceTotal || 0;
      total += value;
      
      const key = `${asset.type}_${asset.detail}`;
      if (itemTotals[key]) {
        itemTotals[key].value += value;
        itemTotals[key].quantity += asset.quantity;
      } else {
        itemTotals[key] = {
          type: asset.type,
          detail: asset.detail,
          value: value,
          quantity: asset.quantity,
        };
      }
    });
    
    const portfolio = Object.values(itemTotals).map(item => ({
      ...item,
      percent: total > 0 ? (item.value / total) * 100 : 0,
    }));
    
    portfolio.sort((a, b) => b.value - a.value);
    return { portfolio, total };
  };

  const showDatePickerModal = () => setShowDatePicker(true);
  const onDateChange = (event, selectedDate) => { 
    setShowDatePicker(false); 
    if (selectedDate) { 
      setTempDate(selectedDate); 
      setFormData({ ...formData, buyDate: selectedDate.toISOString().split('T')[0] }); 
    } 
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    if (page === 0 && activeTab !== 'assets') setActiveTab('assets');
    if (page === 1 && activeTab !== 'portfolio') setActiveTab('portfolio');
  };

  const scrollToPage = (page) => {
    scrollViewRef.current?.scrollTo({ x: page * width, animated: true });
  };

  // ==================== بررسی وضعیت VPN ====================
  useEffect(() => {
    const checkVpnStatus = async () => {
      try {
        if (Platform.OS !== 'web') {
          const result = await ExpoVpnChecker.checkVpn();
          setIsVpnActive(result);
          setVpnStatusText(result ? '✅ VPN فعال است' : '⚠️ VPN فعال نیست');
          
          if (!result && !isOnline) {
            Alert.alert('توجه', 'برای دریافت قیمت‌های لحظه‌ای، لطفاً VPN خود را روشن کنید');
          }
        } else {
          setVpnStatusText('⚠️ وب');
        }
      } catch (error) {
        console.log('خطا در تشخیص VPN:', error);
        setVpnStatusText('❌ خطا در بررسی وضعیت VPN');
      }
    };
    
    checkVpnStatus();
  }, []);

  const renderOwnershipSelector = () => (
    <View style={styles.ownershipSelector}>
      <Text style={styles.fieldLabel}>🏷️ نوع مالکیت</Text>
      <View style={styles.ownershipOptions}>
        <TouchableOpacity 
          style={[styles.ownershipOption, formData.ownership === 'personal' && styles.ownershipOptionActive]}
          onPress={() => setFormData({ ...formData, ownership: 'personal' })}>
          <Text style={styles.ownershipOptionIcon}>👤</Text>
          <Text style={styles.ownershipOptionText}>شخصی</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.ownershipOption, formData.ownership === 'corporate' && styles.ownershipOptionActive]}
          onPress={() => setFormData({ ...formData, ownership: 'corporate' })}>
          <Text style={styles.ownershipOptionIcon}>🏢</Text>
          <Text style={styles.ownershipOptionText}>شرکتی</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAssetForm = () => {
    switch (selectedAssetType) {
      case 'حساب بانکی': return (<><Text style={styles.fieldLabel}>نام بانک یا موسسه</Text><TextInput style={styles.input} placeholder="مثال: ملت، صادرات" value={formData.detail} onChangeText={text => setFormData({ ...formData, detail: text })} /><Text style={styles.fieldLabel}>موجودی (تومان)</Text><TextInput style={styles.input} placeholder="مثال: 50,000,000" keyboardType="numeric" value={formData.buyPriceTotal ? String(formData.buyPriceTotal) : ''} onChangeText={text => setFormData({ ...formData, buyPriceTotal: parseInt(text) || 0 })} /></>);
      case 'پول نقد': return (<><Text style={styles.fieldLabel}>منبع پول نقد</Text><TextInput style={styles.input} placeholder="مثال: صندوق منزل" value={formData.detail} onChangeText={text => setFormData({ ...formData, detail: text })} /><Text style={styles.fieldLabel}>میزان (تومان)</Text><TextInput style={styles.input} placeholder="مثال: 25,000,000" keyboardType="numeric" value={formData.buyPriceTotal ? String(formData.buyPriceTotal) : ''} onChangeText={text => setFormData({ ...formData, buyPriceTotal: parseInt(text) || 0 })} /></>);
      case 'ارز': return (<><Text style={styles.fieldLabel}>نوع ارز</Text><ScrollView horizontal>{SUPPORTED_CURRENCIES.map(currency => (<TouchableOpacity key={currency} style={[styles.currencyButton, formData.detail === currency && styles.typeButtonActive]} onPress={() => setFormData({ ...formData, detail: currency })}><Text style={styles.currencyButtonText}>{currency}</Text></TouchableOpacity>))}</ScrollView><Text style={styles.fieldLabel}>مقدار ارز</Text><TextInput style={styles.input} placeholder="مثال: 500" keyboardType="numeric" value={formData.quantity ? String(formData.quantity) : ''} onChangeText={text => setFormData({ ...formData, quantity: parseFloat(text) || 0 })} /><Text style={styles.fieldLabel}>قیمت کل خرید (تومان)</Text><TextInput style={styles.input} placeholder="مثال: 40,000,000" keyboardType="numeric" value={formData.buyPriceTotal ? String(formData.buyPriceTotal) : ''} onChangeText={text => setFormData({ ...formData, buyPriceTotal: parseInt(text) || 0 })} /></>);
      case 'سکه': return (<><Text style={styles.fieldLabel}>نوع سکه</Text><View style={styles.rowButtons}>{COIN_TYPES.map(coin => (<TouchableOpacity key={coin} style={[styles.smallButton, formData.detail === coin && styles.typeButtonActive]} onPress={() => setFormData({ ...formData, detail: coin })}><Text style={styles.smallButtonText}>{coin}</Text></TouchableOpacity>))}</View><Text style={styles.fieldLabel}>تعداد</Text><TextInput style={styles.input} placeholder="مثال: 2" keyboardType="numeric" value={formData.quantity ? String(formData.quantity) : ''} onChangeText={text => setFormData({ ...formData, quantity: parseInt(text) || 0 })} /><Text style={styles.fieldLabel}>قیمت کل خرید (تومان)</Text><TextInput style={styles.input} placeholder="مثال: 70,000,000" keyboardType="numeric" value={formData.buyPriceTotal ? String(formData.buyPriceTotal) : ''} onChangeText={text => setFormData({ ...formData, buyPriceTotal: parseInt(text) || 0 })} /></>);
      case 'طلا': return (<><Text style={styles.fieldLabel}>عیار طلا</Text><View style={styles.rowButtons}>{['18 عیار', '24 عیار'].map(karat => (<TouchableOpacity key={karat} style={[styles.smallButton, formData.detail === karat && styles.typeButtonActive]} onPress={() => setFormData({ ...formData, detail: karat })}><Text style={styles.smallButtonText}>{karat}</Text></TouchableOpacity>))}</View><Text style={styles.fieldLabel}>وزن (گرم)</Text><TextInput style={styles.input} placeholder="مثال: 10.5" keyboardType="numeric" value={formData.quantity ? String(formData.quantity) : ''} onChangeText={text => setFormData({ ...formData, quantity: parseFloat(text) || 0 })} /><Text style={styles.fieldLabel}>قیمت کل خرید (تومان)</Text><TextInput style={styles.input} placeholder="مثال: 10,000,000" keyboardType="numeric" value={formData.buyPriceTotal ? String(formData.buyPriceTotal) : ''} onChangeText={text => setFormData({ ...formData, buyPriceTotal: parseInt(text) || 0 })} /></>);
      case 'اوراق بهادار و سهام': return (<><Text style={styles.fieldLabel}>نماد/نام صندوق</Text><TextInput style={styles.input} placeholder="مثال: شستا" value={formData.detail} onChangeText={text => setFormData({ ...formData, detail: text })} /><Text style={styles.fieldLabel}>حجم</Text><TextInput style={styles.input} placeholder="مثال: 1000" keyboardType="numeric" value={formData.quantity ? String(formData.quantity) : ''} onChangeText={text => setFormData({ ...formData, quantity: parseInt(text) || 0 })} /><Text style={styles.fieldLabel}>قیمت کل خرید (تومان)</Text><TextInput style={styles.input} placeholder="مثال: 5,000,000" keyboardType="numeric" value={formData.buyPriceTotal ? String(formData.buyPriceTotal) : ''} onChangeText={text => setFormData({ ...formData, buyPriceTotal: parseInt(text) || 0 })} /></>);
      default: return (<><Text style={styles.fieldLabel}>نام دارایی</Text><TextInput style={styles.input} placeholder="مثال: خودرو، ملک" value={formData.detail} onChangeText={text => setFormData({ ...formData, detail: text })} /><Text style={styles.fieldLabel}>ارزش کل (تومان)</Text><TextInput style={styles.input} placeholder="مثال: 500,000,000" keyboardType="numeric" value={formData.buyPriceTotal ? String(formData.buyPriceTotal) : ''} onChangeText={text => setFormData({ ...formData, buyPriceTotal: parseInt(text) || 0 })} /></>);
    }
  };

  const renderAssetItem = (asset) => {
    const profitLoss = getProfitLoss(asset);
    const currentPrice = getCurrentPrice(asset);
    const currentValue = currentPrice ? currentPrice * asset.quantity : asset.buyPriceTotal;
    const isProfit = profitLoss && profitLoss.profit >= 0;
    const profitValue = profitLoss ? Math.abs(profitLoss.profit) : 0;
    const profitPercentValue = profitLoss ? Math.abs(profitLoss.profitPercent) : 0;
    
    if (ownershipFilter !== 'all' && asset.ownership !== ownershipFilter) {
      return null;
    }
    
    return (
      <TouchableOpacity key={asset.id} style={styles.assetItem} onPress={() => { 
        setSelectedAsset(asset); 
        setSelectedAssetType(asset.type); 
        setFormData({ 
          detail: asset.detail, 
          quantity: asset.quantity, 
          buyPriceTotal: asset.buyPriceTotal, 
          buyDate: asset.buyDate, 
          description: asset.description,
          ownership: asset.ownership || 'personal'
        }); 
        setEditModalVisible(true); 
      }} onLongPress={() => deleteAsset(asset.id)} activeOpacity={0.7}>
        <View style={styles.assetRow}>
          <View style={styles.assetIcon}>
            <Text style={styles.assetIconText}>
              {asset.type === 'حساب بانکی' && '🏦'}
              {asset.type === 'پول نقد' && '💰'}
              {asset.type === 'ارز' && '💵'}
              {asset.type === 'سکه' && '🪙'}
              {asset.type === 'طلا' && '🥇'}
              {asset.type === 'اوراق بهادار و سهام' && '📈'}
              {asset.type === 'سایر' && '📦'}
            </Text>
            <View style={styles.ownershipBadge}>
              <Text style={styles.ownershipBadgeText}>
                {asset.ownership === 'corporate' ? '🏢' : '👤'}
              </Text>
            </View>
          </View>
          <View style={styles.assetInfo}>
            <View style={styles.assetHeader}>
              <Text style={styles.assetType}>{asset.type}</Text>
              <Text style={[styles.ownershipLabel, asset.ownership === 'corporate' ? styles.corporateText : styles.personalText]}>
                {asset.ownership === 'corporate' ? 'شرکتی' : 'شخصی'}
              </Text>
            </View>
            <Text style={styles.assetDetail}>{asset.detail}</Text>
            <Text style={styles.assetQuantity}>مقدار: {asset.quantity}</Text>
            <Text style={styles.assetBuyPrice}>قیمت خرید: {formatTomans(asset.buyPriceTotal)} تومان</Text>
            <Text style={styles.assetDate}>تاریخ خرید: {asset.buyDate || 'نامشخص'}</Text>
            {asset.description ? <Text style={styles.assetDesc}>📝 {asset.description}</Text> : null}
          </View>
          <View style={styles.assetValues}>
            <Text style={styles.assetCurrentPrice}>قیمت روز: {currentPrice ? formatTomans(currentPrice) : 'N/A'} تومان</Text>
            <Text style={styles.assetCurrentValue}>ارزش روز: {formatTomans(currentValue)} تومان</Text>
            {profitLoss && (
              <Text style={[styles.assetProfit, isProfit ? styles.positive : styles.negative]}>
                {isProfit ? 'سود: ' : 'زیان: '}{formatTomans(profitValue)} تومان ({profitPercentValue.toFixed(1)}%)
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAssetsContent = () => {
    const filteredAssets = assets.filter(asset => {
      if (ownershipFilter === 'all') return true;
      return asset.ownership === ownershipFilter;
    });
    const filteredAssetsCount = filteredAssets.length;
    const ownershipStats = getOwnershipStats();
    
    return (
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196f3']} />}>
        <View style={styles.header}>
          <Text style={styles.title}>مدیریت دارایی شخصی</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={() => setPriceModalVisible(true)}>
              <Text style={styles.headerButtonText}>⚙️ قیمت‌ها</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
              <Text style={styles.headerButtonText}>🔄 بروزرسانی</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerButton, styles.addButton]} onPress={() => { 
              setSelectedAssetType('حساب بانکی'); 
              setFormData({ quantity: 1, ownership: 'personal' }); 
              setModalVisible(true); 
            }}>
              <Text style={styles.headerButtonText}>➕ ثبت دارایی</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>🔍 فیلتر بر اساس:</Text>
            <View style={styles.filterButtons}>
              <TouchableOpacity 
                style={[styles.filterButton, ownershipFilter === 'all' && styles.filterActive]}
                onPress={() => setOwnershipFilter('all')}>
                <Text style={[styles.filterButtonText, ownershipFilter === 'all' && styles.filterActiveText]}>همه</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterButton, ownershipFilter === 'personal' && styles.filterActivePersonal]}
                onPress={() => setOwnershipFilter('personal')}>
                <Text style={styles.filterButtonText}>👤 شخصی</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterButton, ownershipFilter === 'corporate' && styles.filterActiveCorporate]}
                onPress={() => setOwnershipFilter('corporate')}>
                <Text style={styles.filterButtonText}>🏢 شرکتی</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
          <Text style={styles.statusText}>{isOnline ? 'آنلاین' : 'آفلاین - خطا در دریافت نرخ ارزها'}</Text>
          {lastUpdateTime && <Text style={styles.lastUpdateText}>آخرین بروزرسانی: {lastUpdateTime}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 12 }}>
            <View style={[styles.statusDot, { backgroundColor: isVpnActive ? '#28a745' : '#dc3545' }]} />
            <Text style={styles.statusText}>{vpnStatusText}</Text>
          </View>
        </View>
        
        <View style={styles.cardsContainerVertical}>
          <View style={styles.cardVertical}><Text style={styles.cardTitle}>ارزش کل امروز</Text><Text style={styles.totalValue}>{formatTomans(totalValue)} تومان</Text></View>
          <View style={styles.cardVertical}><Text style={styles.cardTitle}>تغییر نسبت به ماه قبل</Text><Text style={[styles.changeValue, monthlyChange >= 0 ? styles.positive : styles.negative]}>{monthlyChange !== null ? `${Math.abs(monthlyChange).toFixed(1)}%` : '0.0%'}</Text></View>
        </View>
        
        <View style={styles.ownershipStatsCard}>
          <View style={styles.ownershipStatsHeader}>
            <Text style={styles.ownershipStatsTitle}>📊 نسبت دارایی‌ها (شخصی/شرکتی)</Text>
            <TouchableOpacity onPress={() => setShowOwnershipChart(!showOwnershipChart)}>
              <Text style={styles.chartToggle}>{showOwnershipChart ? '📋 نمایش لیست' : '📊 نمایش نمودار'}</Text>
            </TouchableOpacity>
          </View>
          
          {showOwnershipChart ? (
            <View style={styles.pieChartContainer}>
              <View style={styles.pieChart}>
                <View style={[styles.pieSegment, { width: `${ownershipStats.personal.percent}%`, backgroundColor: '#2196f3', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} />
                <View style={[styles.pieSegment, { width: `${ownershipStats.corporate.percent}%`, backgroundColor: '#ff9800', borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} />
              </View>
              <View style={styles.pieLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#2196f3' }]} />
                  <Text style={styles.legendText}>شخصی: {ownershipStats.personal.percent.toFixed(1)}%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#ff9800' }]} />
                  <Text style={styles.legendText}>شرکتی: {ownershipStats.corporate.percent.toFixed(1)}%</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.ownershipStatsDetails}>
              <View style={styles.statBox}>
                <Text style={styles.statIcon}>👤</Text>
                <Text style={styles.statValue}>{formatTomans(ownershipStats.personal.value)} تومان</Text>
                <Text style={styles.statLabel}>شخصی ({ownershipStats.personal.count} قلم)</Text>
                <Text style={[styles.statPercent, styles.personalText]}>{ownershipStats.personal.percent.toFixed(1)}%</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statIcon}>🏢</Text>
                <Text style={styles.statValue}>{formatTomans(ownershipStats.corporate.value)} تومان</Text>
                <Text style={styles.statLabel}>شرکتی ({ownershipStats.corporate.count} قلم)</Text>
                <Text style={[styles.statPercent, styles.corporateText]}>{ownershipStats.corporate.percent.toFixed(1)}%</Text>
              </View>
            </View>
          )}
        </View>
        
        <Text style={styles.sectionTitle}>📋 دارایی‌های من {ownershipFilter !== 'all' && `(${ownershipFilter === 'personal' ? 'شخصی' : 'شرکتی'})`}</Text>
        {filteredAssets.map(asset => renderAssetItem(asset))}
        {filteredAssetsCount === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>هیچ دارایی با این فیلتر یافت نشد</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderPortfolioContent = () => {
    const { portfolio, total } = getGroupedPortfolioData();
    const ownershipStats = getOwnershipStats();
    
    return (
      <ScrollView style={styles.portfolioContainer}>
        <View style={styles.ownershipBreakdownCard}>
          <Text style={styles.portfolioTitle}>🏢 vs 👤 تفکیک مالکیت</Text>
          <View style={styles.ownershipComparison}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonIcon}>👤 شخصی</Text>
              <Text style={styles.comparisonValue}>{formatTomans(ownershipStats.personal.value)}</Text>
              <View style={styles.comparisonBar}>
                <View style={[styles.comparisonFill, { width: `${ownershipStats.personal.percent}%`, backgroundColor: '#2196f3' }]} />
              </View>
              <Text style={styles.comparisonPercent}>{ownershipStats.personal.percent.toFixed(1)}%</Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonIcon}>🏢 شرکتی</Text>
              <Text style={styles.comparisonValue}>{formatTomans(ownershipStats.corporate.value)}</Text>
              <View style={styles.comparisonBar}>
                <View style={[styles.comparisonFill, { width: `${ownershipStats.corporate.percent}%`, backgroundColor: '#ff9800' }]} />
              </View>
              <Text style={styles.comparisonPercent}>{ownershipStats.corporate.percent.toFixed(1)}%</Text>
            </View>
          </View>
          <View style={styles.totalOwnership}>
            <Text style={styles.totalOwnershipText}>مجموع کل: {formatTomans(ownershipStats.total)} تومان</Text>
          </View>
        </View>
        
        <View style={styles.portfolioCard}>
          <Text style={styles.portfolioTitle}>📊 تحلیل پرتفوی دارایی‌ها</Text>
          <Text style={styles.portfolioTotal}>مجموع: {formatTomans(total)} تومان</Text>
          
          {portfolio.length > 0 ? (
            <>
              <View style={styles.detailsTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 2.5 }]}>عنوان دارایی</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.5 }]}>مقدار</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.5 }]}>درصد</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 2 }]}>ارزش (تومان)</Text>
                </View>
                {portfolio.map((item, index) => {
                  let quantityDisplay = '';
                  if (item.type === 'ارز') quantityDisplay = `${item.quantity} واحد`;
                  else if (item.type === 'سکه') quantityDisplay = `${item.quantity} عدد`;
                  else if (item.type === 'طلا') quantityDisplay = `${item.quantity} گرم`;
                  else if (item.type === 'اوراق بهادار و سهام') quantityDisplay = `${item.quantity} سهم`;
                  else quantityDisplay = '-';
                  
                  let titleDisplay = item.detail;
                  if (item.type === 'ارز') titleDisplay = `${item.detail} (${getCurrencyName(item.detail)})`;
                  if (item.type === 'سکه') titleDisplay = `سکه ${item.detail}`;
                  if (item.type === 'طلا') titleDisplay = `طلا ${item.detail}`;
                  
                  return (
                    <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                      <Text style={[styles.tableCell, { flex: 2.5, color: getColorForType(item.type), fontWeight: 'bold' }]}>
                        {getIconForType(item.type)} {titleDisplay}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1.5 }]}>{quantityDisplay}</Text>
                      <Text style={[styles.tableCell, { flex: 1.5, fontWeight: 'bold', color: getColorForType(item.type) }]}>{item.percent.toFixed(1)}%</Text>
                      <Text style={[styles.tableCell, { flex: 2 }]}>{formatTomans(item.value)}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>📊 نمودار توزیع دارایی‌ها</Text>
                {portfolio.map((item, index) => {
                  let titleDisplay = item.detail;
                  if (item.type === 'ارز') titleDisplay = `${item.detail}`;
                  if (item.type === 'سکه') titleDisplay = `${item.detail}`;
                  return (
                    <View key={index} style={styles.chartItem}>
                      <View style={styles.chartHeader}>
                        <Text style={styles.chartType}>
                          {getIconForType(item.type)} {titleDisplay}
                        </Text>
                        <Text style={styles.chartPercent}>{item.percent.toFixed(1)}%</Text>
                      </View>
                      <View style={styles.barContainer}>
                        <View style={[styles.bar, { width: `${item.percent}%`, backgroundColor: getColorForType(item.type) }]} />
                      </View>
                      <Text style={styles.chartValue}>{formatTomans(item.value)} تومان</Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.emptyPortfolio}>
              <Text style={styles.emptyText}>هیچ دارایی ثبت نشده است</Text>
              <Text style={styles.emptySubText}>برای مشاهده تحلیل پرتفوی، ابتدا دارایی ثبت کنید</Text>
            </View>
          )}
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 نکات مدیریت سرمایه</Text>
          <View style={styles.tipItem}><Text style={styles.tipIcon}>📌</Text><Text style={styles.tipText}>تنوع‌بخشید: سعی کنید دارایی‌های خود را بین چند دسته مختلف پخش کنید</Text></View>
          <View style={styles.tipItem}><Text style={styles.tipIcon}>📌</Text><Text style={styles.tipText}>بروزرسانی منظم: قیمت‌های پایه را هر هفته به‌روز کنید</Text></View>
          <View style={styles.tipItem}><Text style={styles.tipIcon}>📌</Text><Text style={styles.tipText}>ریسک‌پذیری: بیش از ۳۰٪ سرمایه خود را در یک دارایی متمرکز نکنید</Text></View>
          <View style={styles.tipItem}><Text style={styles.tipIcon}>📌</Text><Text style={styles.tipText}>سود مرکب: سود خود را دوباره سرمایه‌گذاری کنید</Text></View>
        </View>
      </ScrollView>
    );
  };

  const getCurrencyName = (code) => {
    const names = {
      'USD': 'دلار آمریکا', 'EUR': 'یورو', 'AED': 'درهم امارات', 'GBP': 'پوند انگلیس',
      'JPY': 'ین ژاپن', 'CAD': 'دلار کانادا', 'CHF': 'فرانک سوئیس', 'TRY': 'لیره ترکیه',
      'CNY': 'یوان چین', 'AUD': 'دلار استرالیا', 'SGD': 'دلار سنگاپور'
    };
    return names[code] || code;
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'حساب بانکی': return '🏦';
      case 'پول نقد': return '💰';
      case 'ارز': return '💵';
      case 'سکه': return '🪙';
      case 'طلا': return '🥇';
      case 'اوراق بهادار و سهام': return '📈';
      default: return '📦';
    }
  };

  const getColorForType = (type) => {
    switch (type) {
      case 'حساب بانکی': return '#2196f3';
      case 'پول نقد': return '#4caf50';
      case 'ارز': return '#ff9800';
      case 'سکه': return '#9c27b0';
      case 'طلا': return '#ffc107';
      case 'اوراق بهادار و سهام': return '#f44336';
      default: return '#607d8b';
    }
  };

  // ==================== useEffect ====================
  useEffect(() => { 
    loadAllData(); 
    fetchExchangeRates(); 
    fetchOnlinePrices(); 
    const interval = setInterval(() => { fetchExchangeRates(); fetchOnlinePrices(); }, 21600000); 
    return () => clearInterval(interval); 
  }, []);
  
  useEffect(() => { calculateTotalValue(); }, [assets, manualPrices, exchangeRates]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tab, activeTab === 'assets' && styles.activeTab]} onPress={() => { setActiveTab('assets'); scrollToPage(0); }}>
            <Text style={[styles.tabText, activeTab === 'assets' && styles.activeTabText]}>📋 دارایی‌ها</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'portfolio' && styles.activeTab]} onPress={() => { setActiveTab('portfolio'); scrollToPage(1); }}>
            <Text style={[styles.tabText, activeTab === 'portfolio' && styles.activeTabText]}>📊 ترکیب دارایی</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}>
          <View style={{ width: width }}>{renderAssetsContent()}</View>
          <View style={{ width: width }}>{renderPortfolioContent()}</View>
        </ScrollView>

        <Modal animationType="slide" transparent={true} visible={modalVisible}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>✨ افزودن دارایی جدید</Text>
              <ScrollView>
                <Text style={styles.label}>نوع دارایی</Text>
                <ScrollView horizontal>
                  {ASSET_TYPES.map(type => (
                    <TouchableOpacity key={type} style={[styles.typeButton, selectedAssetType === type && styles.typeButtonActive]} onPress={() => setSelectedAssetType(type)}>
                      <Text style={styles.typeButtonText}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {renderAssetForm()}
                {renderOwnershipSelector()}
                <Text style={styles.fieldLabel}>تاریخ خرید</Text>
                <TouchableOpacity style={styles.dateButton} onPress={showDatePickerModal}>
                  <Text style={styles.dateButtonText}>{formData.buyDate || 'انتخاب تاریخ'}</Text>
                </TouchableOpacity>
                {showDatePicker && (<DateTimePicker value={tempDate} mode="date" display="default" onChange={onDateChange} />)}
                <Text style={styles.fieldLabel}>توضیحات (اختیاری)</Text>
                <TextInput style={[styles.input, styles.textArea]} placeholder="توضیحات" multiline numberOfLines={3} value={formData.description} onChangeText={text => setFormData({ ...formData, description: text })} />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelButtonText}>انصراف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitButton} onPress={() => { 
                    saveAsset({ 
                      type: selectedAssetType, 
                      detail: formData.detail || '', 
                      quantity: formData.quantity || 1, 
                      buyPriceTotal: formData.buyPriceTotal || 0, 
                      buyDate: formData.buyDate || new Date().toISOString().split('T')[0], 
                      description: formData.description || '',
                      ownership: formData.ownership || 'personal'
                    }); 
                  }}>
                    <Text style={styles.submitButtonText}>✓ افزودن</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal animationType="slide" transparent={true} visible={editModalVisible}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>✏️ ویرایش دارایی</Text>
              <ScrollView>
                <Text style={styles.label}>نوع دارایی</Text>
                <ScrollView horizontal>
                  {ASSET_TYPES.map(type => (
                    <TouchableOpacity key={type} style={[styles.typeButton, selectedAssetType === type && styles.typeButtonActive]} onPress={() => setSelectedAssetType(type)}>
                      <Text style={styles.typeButtonText}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {renderAssetForm()}
                {renderOwnershipSelector()}
                <Text style={styles.fieldLabel}>تاریخ خرید</Text>
                <TouchableOpacity style={styles.dateButton} onPress={showDatePickerModal}>
                  <Text style={styles.dateButtonText}>{formData.buyDate || 'انتخاب تاریخ'}</Text>
                </TouchableOpacity>
                <Text style={styles.fieldLabel}>توضیحات</Text>
                <TextInput style={[styles.input, styles.textArea]} placeholder="توضیحات" multiline numberOfLines={3} value={formData.description} onChangeText={text => setFormData({ ...formData, description: text })} />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                    <Text style={styles.cancelButtonText}>انصراف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitButton} onPress={() => { 
                    saveAsset({ 
                      type: selectedAssetType, 
                      detail: formData.detail || '', 
                      quantity: formData.quantity || 1, 
                      buyPriceTotal: formData.buyPriceTotal || 0, 
                      buyDate: formData.buyDate || new Date().toISOString().split('T')[0], 
                      description: formData.description || '',
                      ownership: formData.ownership || 'personal'
                    }, true); 
                  }}>
                    <Text style={styles.submitButtonText}>✓ ذخیره تغییرات</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal animationType="slide" transparent={true} visible={priceModalVisible}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚙️ تنظیم قیمت‌های پایه</Text>
              <Text style={styles.modalSubtitle}>قیمت‌ها به تومان وارد شوند</Text>
              <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#28a745', marginBottom: 10 }]} onPress={async () => {
                await fetchOnlinePrices();
                Alert.alert('موفقیت', 'قیمت‌ها با موفقیت بروزرسانی شدند');
              }}>
                <Text style={styles.submitButtonText}>🔄 بروزرسانی خودکار قیمت‌ها</Text>
              </TouchableOpacity>
              <ScrollView>
                <Text style={styles.fieldLabel}>💵 قیمت دلار (USD)</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="مثال: 60000" value={manualPrices.USD ? String(manualPrices.USD) : ''} onChangeText={text => updateManualPrice('USD', parseInt(text) || 0)} />
                <Text style={styles.fieldLabel}>🥇 قیمت طلای ۱۸ عیار - هر گرم (تومان)</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="مثال: 3500000" value={manualPrices.GOLD_18_PER_GRAM ? String(manualPrices.GOLD_18_PER_GRAM) : ''} onChangeText={text => updateManualPrice('GOLD_18_PER_GRAM', parseInt(text) || 0)} />
                <Text style={styles.fieldLabel}>🪙 قیمت سکه امامی (تومان)</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="مثال: 40000000" value={manualPrices.COIN_EMAMI ? String(manualPrices.COIN_EMAMI) : ''} onChangeText={text => updateManualPrice('COIN_EMAMI', parseInt(text) || 0)} />
                <Text style={styles.fieldLabel}>🪙 قیمت نیم سکه (تومان)</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="مثال: 20000000" value={manualPrices.COIN_NIM ? String(manualPrices.COIN_NIM) : ''} onChangeText={text => updateManualPrice('COIN_NIM', parseInt(text) || 0)} />
                <Text style={styles.fieldLabel}>🪙 قیمت ربع سکه (تومان)</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="مثال: 10000000" value={manualPrices.COIN_ROB ? String(manualPrices.COIN_ROB) : ''} onChangeText={text => updateManualPrice('COIN_ROB', parseInt(text) || 0)} />
                <Text style={styles.fieldLabel}>🪙 قیمت سکه گرمی (تومان)</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="مثال: 5000000" value={manualPrices.COIN_GERAMI ? String(manualPrices.COIN_GERAMI) : ''} onChangeText={text => updateManualPrice('COIN_GERAMI', parseInt(text) || 0)} />
                <TouchableOpacity style={styles.submitButton} onPress={() => { setPriceModalVisible(false); calculateTotalValue(); Alert.alert('موفقیت', 'قیمت‌های پایه با موفقیت ذخیره شدند.'); }}>
                  <Text style={styles.submitButtonText}>✓ ذخیره و بستن</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
		
		{/* WebView مخفی برای دریافت قیمت‌ها از bonbast */}
<WebView
  source={{ uri: 'https://bonbast.com/' }}
  style={{ display: 'none', width: 0, height: 0 }}
  onMessage={async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const { usdPrice, geram18Price, sekebPrice, nimPrice, robPrice } = data;
      
      if (usdPrice && geram18Price) {
        const newPrices = {
          USD: usdPrice,
          GOLD_18_PER_GRAM: geram18Price,
          COIN_EMAMI: sekebPrice || geram18Price * 8.133,
          COIN_NIM: nimPrice || (sekebPrice / 2) || (geram18Price * 4.066),
          COIN_ROB: robPrice || (sekebPrice / 4) || (geram18Price * 2.033),
          COIN_GERAMI: geram18Price,
        };
        
        setManualPrices(newPrices);
        await AsyncStorage.setItem('manualPrices', JSON.stringify(newPrices));
        setIsOnline(true);
        Alert.alert('موفقیت', 'قیمت‌ها با موفقیت بروزرسانی شدند.');
      }
    } catch (error) {
      console.log('خطا در پردازش داده bonbast:', error);
    }
  }}
  injectedJavaScript={`
    (function() {
      function getNumberFromText(str) {
        if (!str) return null;
        const match = str.toString().match(/[\\d,]+/g);
        if (match) {
          return parseInt(match[0].replace(/,/g, ''));
        }
        return null;
      }
      
      function getPrice(selector, isGold = false) {
        const element = document.querySelector(selector);
        if (element) {
          let priceText = element.innerText || element.textContent;
          if (isGold) {
            const match = priceText.match(/[\\d,]+/g);
            if (match) return parseInt(match[0].replace(/,/g, ''));
          }
          return getNumberFromText(priceText);
        }
        return null;
      }
      
      function getAllPrices() {
        const usdElement = document.querySelector('#main-price-USD');
        if (usdElement && usdElement.innerText) {
          const usdPrice = getNumberFromText(usdElement.innerText);
          const goldElement = document.querySelector('td:contains("طلای 18 عیار")');
          let goldPrice = null;
          
          if (goldElement) {
            const goldRow = goldElement.closest('tr');
            if (goldRow) {
              const priceCell = goldRow.querySelector('td.price, td:nth-child(2)');
              if (priceCell) goldPrice = getNumberFromText(priceCell.innerText);
            }
          }
          
          if (usdPrice && goldPrice) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              usdPrice: usdPrice,
              geram18Price: goldPrice
            }));
          } else {
            setTimeout(getAllPrices, 500);
          }
        } else {
          setTimeout(getAllPrices, 500);
        }
      }
      
      setTimeout(getAllPrices, 1000);
    })();
  `}
/>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#2196f3' }, tabText: { fontSize: 16, color: '#666' }, activeTabText: { color: '#2196f3', fontWeight: 'bold' },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 },
  headerButtons: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  headerButton: { backgroundColor: '#2196f3', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 25 },
  headerButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' }, addButton: { backgroundColor: '#28a745' },
  statusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 8, flexWrap: 'wrap' },
  statusDot: { width: 12, height: 12, borderRadius: 6 }, online: { backgroundColor: '#28a745' }, offline: { backgroundColor: '#dc3545' },
  statusText: { fontSize: 12, color: '#666' }, lastUpdateText: { fontSize: 10, color: '#999', marginLeft: 8 },
  cardsContainerVertical: { padding: 16, gap: 12 },
  cardVertical: { backgroundColor: '#fff', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, elevation: 3, alignItems: 'center' },
  cardTitle: { fontSize: 14, color: '#666', marginBottom: 12, textAlign: 'center' },
  totalValue: { fontSize: 28, fontWeight: 'bold', color: '#2e7d32', textAlign: 'center' },
  changeValue: { fontSize: 28, fontWeight: 'bold', textAlign: 'center' }, positive: { color: '#2e7d32' }, negative: { color: '#dc3545' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 16, paddingVertical: 12, color: '#1a1a1a' },
  assetItem: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, elevation: 2 },
  assetRow: { flexDirection: 'row' }, assetIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f0f7ff', justifyContent: 'center', alignItems: 'center', marginRight: 14, position: 'relative' },
  assetIconText: { fontSize: 26 }, assetInfo: { flex: 2 }, assetType: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  assetDetail: { fontSize: 14, color: '#666', marginTop: 2 }, assetQuantity: { fontSize: 12, color: '#888', marginTop: 2 },
  assetBuyPrice: { fontSize: 12, color: '#888' }, assetDate: { fontSize: 11, color: '#999', marginTop: 2 },
  assetDesc: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 2 }, assetValues: { alignItems: 'flex-end', justifyContent: 'center' },
  assetCurrentPrice: { fontSize: 12, color: '#666' }, assetCurrentValue: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  assetProfit: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  ownershipBadge: { position: 'absolute', bottom: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  ownershipBadgeText: { fontSize: 12 },
  assetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ownershipLabel: { fontSize: 11, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, overflow: 'hidden' },
  personalText: { backgroundColor: '#e3f2fd', color: '#1976d2' }, corporateText: { backgroundColor: '#fff3e0', color: '#f57c00' },
  filterContainer: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  filterLabel: { fontSize: 12, color: '#666', marginBottom: 8 },
  filterButtons: { flexDirection: 'row', gap: 10 },
  filterButton: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', alignItems: 'center' },
  filterActive: { backgroundColor: '#2196f3' },
  filterActivePersonal: { backgroundColor: '#2196f3' },
  filterActiveCorporate: { backgroundColor: '#ff9800' },
  filterButtonText: { fontSize: 13, color: '#666' },
  filterActiveText: { color: '#fff', fontWeight: 'bold' },
  ownershipStatsCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, marginBottom: 8, padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, elevation: 3 },
  ownershipStatsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ownershipStatsTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' }, chartToggle: { fontSize: 12, color: '#2196f3' },
  pieChartContainer: { alignItems: 'center' }, pieChart: { flexDirection: 'row', height: 40, width: '100%', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  pieSegment: { height: 40 }, pieLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legendColor: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#666' }, ownershipStatsDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 1, alignItems: 'center' }, statDivider: { width: 1, backgroundColor: '#e0e0e0', marginHorizontal: 16 },
  statIcon: { fontSize: 28, marginBottom: 8 }, statValue: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666', marginBottom: 4 }, statPercent: { fontSize: 14, fontWeight: 'bold' },
  portfolioContainer: { padding: 16 }, portfolioCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, elevation: 3 },
  portfolioTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  portfolioTotal: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  detailsTable: { marginTop: 16, marginBottom: 20 }, tableHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, marginBottom: 4 },
  tableHeaderCell: { fontWeight: 'bold', color: '#333' }, tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2 },
  tableRowEven: { backgroundColor: '#fafafa' }, tableRowOdd: { backgroundColor: '#fff' }, tableCell: { fontSize: 13 },
  chartContainer: { marginTop: 20 }, chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 16, textAlign: 'center' },
  chartItem: { marginBottom: 16 }, chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartType: { fontSize: 14, fontWeight: '600', color: '#333' }, chartPercent: { fontSize: 14, fontWeight: 'bold', color: '#2196f3' },
  barContainer: { height: 24, backgroundColor: '#e0e0e0', borderRadius: 12, overflow: 'hidden', marginBottom: 6 },
  bar: { height: 24, borderRadius: 12 }, chartValue: { fontSize: 12, color: '#666', textAlign: 'right' },
  emptyPortfolio: { paddingVertical: 40, alignItems: 'center' },
  tipsCard: { backgroundColor: '#e8f5e9', borderRadius: 16, padding: 16, marginBottom: 16 },
  tipsTitle: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginBottom: 12, textAlign: 'center' },
  tipItem: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' }, tipIcon: { fontSize: 16, marginRight: 8 },
  tipText: { fontSize: 13, color: '#333', flex: 1, lineHeight: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 12, color: '#1a1a1a' },
  textArea: { textAlignVertical: 'top', minHeight: 80 }, label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  typeButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, backgroundColor: '#f0f0f0', marginRight: 8, marginBottom: 8 },
  typeButtonActive: { backgroundColor: '#2196f3' }, typeButtonText: { color: '#555', fontSize: 14 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8, marginBottom: 8 },
  smallButtonText: { color: '#555', fontSize: 13 }, rowButtons: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  currencyButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8, marginBottom: 8 },
  currencyButtonText: { color: '#555', fontSize: 13 }, dateButton: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, backgroundColor: '#fafafa', marginBottom: 12 },
  dateButtonText: { fontSize: 15, color: '#1a1a1a' }, ownershipSelector: { marginTop: 8 },
  ownershipOptions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  ownershipOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f0f0f0', borderWidth: 2, borderColor: 'transparent' },
  ownershipOptionActive: { backgroundColor: '#e3f2fd', borderColor: '#2196f3' }, ownershipOptionIcon: { fontSize: 20 }, ownershipOptionText: { fontSize: 14, fontWeight: '500', color: '#333' },
  ownershipBreakdownCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, elevation: 3 },
  ownershipComparison: { marginTop: 8 }, comparisonItem: { marginBottom: 16 }, comparisonIcon: { fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  comparisonValue: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  comparisonBar: { height: 24, backgroundColor: '#f0f0f0', borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
  comparisonFill: { height: 24, borderRadius: 12 }, comparisonPercent: { fontSize: 12, color: '#666', textAlign: 'right' },
  totalOwnership: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0', alignItems: 'center' },
  totalOwnershipText: { fontSize: 14, fontWeight: 'bold', color: '#333' }, modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 28, padding: 20, width: width * 0.92, maxHeight: height * 0.85 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelButtonText: { color: '#666', fontWeight: '600', fontSize: 16 },
  submitButton: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#2196f3', alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  emptyState: { paddingVertical: 60, alignItems: 'center' }, emptyText: { fontSize: 16, color: '#999', textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#ccc', marginTop: 8, textAlign: 'center' },
});