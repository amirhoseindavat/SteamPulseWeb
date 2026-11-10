import { useEffect, useRef, useState } from "react";
import { searchGames as fetchGameSearch } from "../services/steamPulseApi";

export function useGameSearch({ region, loadGame, setQuery, setInputId, setError }) {
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  async function searchGames(term) {
    if (term.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const data = await fetchGameSearch(term, region);
      setResults(data.items || []);
      setSearchOpen(true);
    } catch (error) {
      setResults([]);
      setError(error.message || "Steam search failed. Check that the API server is running.");
    } finally {
      setSearching(false);
    }
  }

  function onSearchChange(value) {
    setQuery(value);
    setSearchOpen(true);
    clearTimeout(debounceRef.current);
    if (/^\d+$/.test(value.trim())) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => searchGames(value), 300);
  }

  function chooseGame(item) {
    setQuery(item.name);
    setInputId(String(item.id));
    setSearchOpen(false);
    loadGame(item.id, region);
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return { results, setResults, searchOpen, setSearchOpen, searching, searchGames, onSearchChange, chooseGame };
}
