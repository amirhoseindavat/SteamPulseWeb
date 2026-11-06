import { useEffect, useState } from "react";
import { readApiResponse } from "../utils/api";

export function useMarketData(region, currentPage) {
  const [shopData, setShopData] = useState(null);
  const [shopDataLoading, setShopDataLoading] = useState(false);
  const [shopDataError, setShopDataError] = useState("");
  const [shopDataUpdatedAt, setShopDataUpdatedAt] = useState(null);
  const [regionalKeyPrice, setRegionalKeyPrice] = useState(null);
  const [regionalMarketData, setRegionalMarketData] = useState([]);
  const [regionalMarketLoading, setRegionalMarketLoading] = useState(false);
  const [regionalMarketError, setRegionalMarketError] = useState("");
  const [regionalMarketUpdatedAt, setRegionalMarketUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadShopData = async () => {
      setShopDataLoading(true);
      setShopDataError("");
      try {
        const response = await fetch("/api/shop-data");
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load live key prices.");
        const keyPrice = Number(String(data.Key ?? "").replace(/[\s,٬]/g, ""));
        if (!Number.isFinite(keyPrice) || keyPrice <= 0) throw new Error("The shop API returned an invalid key price.");
        if (!cancelled) { setShopData({ ...data, Key: keyPrice }); setShopDataUpdatedAt(new Date()); }
      } catch (error) {
        if (!cancelled) setShopDataError(error.message || "Live key prices are temporarily unavailable.");
      } finally {
        if (!cancelled) setShopDataLoading(false);
      }
    };
    loadShopData();
    const timer = setInterval(loadShopData, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRegionalKeyPrice = async () => {
      try {
        const response = await fetch(`/api/key-price?region=${encodeURIComponent(region)}`);
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load this region's Steam key price.");
        if (!cancelled) setRegionalKeyPrice(data);
      } catch (error) {
        if (!cancelled) setRegionalKeyPrice({ region, error: error.message || "Steam key price unavailable." });
      }
    };
    setRegionalKeyPrice(null);
    loadRegionalKeyPrice();
    const timer = setInterval(loadRegionalKeyPrice, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [region]);

  useEffect(() => {
    if (currentPage !== "market") return;
    let cancelled = false;
    const loadRegionalMarket = async () => {
      setRegionalMarketLoading(true);
      setRegionalMarketError("");
      try {
        const response = await fetch("/api/market-regions");
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Could not load Steam Market regional prices.");
        if (!cancelled) {
          setRegionalMarketData(Array.isArray(data.regions) ? data.regions : []);
          setRegionalMarketUpdatedAt(new Date());
        }
      } catch (error) {
        if (!cancelled) setRegionalMarketError(error.message || "Steam Market data is temporarily unavailable.");
      } finally {
        if (!cancelled) setRegionalMarketLoading(false);
      }
    };
    loadRegionalMarket();
    const timer = setInterval(loadRegionalMarket, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [currentPage]);

  async function refreshShopData() {
    setShopDataLoading(true);
    setShopDataError("");
    try {
      const response = await fetch("/api/shop-data");
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not load live key prices.");
      setShopData(data);
      setShopDataUpdatedAt(new Date());
    } catch (error) {
      setShopDataError(error.message || "Refresh failed.");
    } finally {
      setShopDataLoading(false);
    }
  }

  return {
    shopData, shopDataLoading, shopDataError, shopDataUpdatedAt,
    regionalKeyPrice, regionalMarketData, regionalMarketLoading,
    regionalMarketError, regionalMarketUpdatedAt, refreshShopData
  };
}
