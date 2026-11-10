import { useEffect, useRef, useState } from "react";
import { searchGames as fetchGameSearch } from "../services/steamPulseApi";

export function useGameSearch({ region, loadGame, setQuery, setInputId, setError }) {
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const requestRef = useRef(null);
  const requestIdRef = useRef(0);

  function cancelSearch() {
    clearTimeout(debounceRef.current);
    requestRef.current?.abort();
    requestRef.current = null;
    requestIdRef.current += 1;
  }

  async function searchGames(term) {
    if (term.trim().length < 2) {
      cancelSearch();
      setResults([]);
      setSearching(false);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const requestId = ++requestIdRef.current;
    setSearching(true);
    setError("");

    try {
      const data = await fetchGameSearch(term, region, controller.signal);
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setResults(data.items || []);
      setSearchOpen(true);
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setResults([]);
      setError(error.message || "Steam search failed. Check that the API server is running.");
    } finally {
      if (!controller.signal.aborted && requestId === requestIdRef.current) setSearching(false);
    }
  }

  function onSearchChange(value) {
    setQuery(value);
    setSearchOpen(true);
    cancelSearch();
    if (/^\d+$/.test(value.trim())) {
      setResults([]);
      setSearching(false);
      return;
    }
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchGames(value), 300);
  }

  function chooseGame(item) {
    cancelSearch();
    setSearching(false);
    setQuery(item.name);
    setInputId(String(item.id));
    setSearchOpen(false);
    loadGame(item.id, region);
  }

  useEffect(() => {
    cancelSearch();
    setSearching(false);
    return () => cancelSearch();
  }, [region]);

  return { results, setResults, searchOpen, setSearchOpen, searching, searchGames, onSearchChange, chooseGame };
}
