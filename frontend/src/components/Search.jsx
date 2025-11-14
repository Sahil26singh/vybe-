import React, { useEffect, useState } from "react";
import axios from "axios";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Input } from "./ui/input";

export default function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [debounced, setDebounced] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const run = async () => {
      if (!debounced.trim()) { setResults([]); setSuggestions([]); return; }
      const res = await axios.get(
        `http://localhost:8000/api/v1/user/search?query=${encodeURIComponent(debounced)}`,
        { withCredentials: true }
      );
      setResults(res.data?.results || []);
      setSuggestions(res.data?.suggestions || []);
    };
    run();
  }, [debounced]);

  const Row = (u) => (
    <a key={u._id} href={`/profile/${u._id}`} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg">
      <Avatar className="w-8 h-8">
        <AvatarImage src={u.profilePicture} />
        <AvatarFallback>{(u.username||"X").slice(0,2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="text-sm font-medium">{u.username}</div>
    </a>
  );

  return (
    <div className="pl-[20%] pr-6 py-6 max-w-3xl">
      <h2 className="text-xl font-semibold mb-4">Search users</h2>
      <Input placeholder="Search by username…" value={q} onChange={(e)=>setQ(e.target.value)} />

      <div className="mt-6">
        <h3 className="font-medium mb-2">Top matches</h3>
        {results.length ? <div className="space-y-2">{results.map(Row)}</div> : <p className="text-sm text-gray-500">No matches</p>}
      </div>

      <div className="mt-6">
        <h3 className="font-medium mb-2">Suggestions</h3>
        {suggestions.length ? <div className="space-y-2">{suggestions.map(Row)}</div> : <p className="text-sm text-gray-500">No suggestions</p>}
      </div>
    </div>
  );
}
