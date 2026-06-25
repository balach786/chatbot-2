import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchApplications,
  type Application,
  COLUMNS,
  POLL_INTERVAL_MS,
} from "@/lib/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, RefreshCw, Sparkles } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Applications Portal — Admin Dashboard" },
      {
        name: "description",
        content:
          "Admin dashboard to view and manage applications synced live from a Google Sheet.",
      },
    ],
  }),
  component: Dashboard,
});

type SortDir = "asc" | "desc";
const ALL = "__all__";

function Dashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const isFirst = useRef(true);

  // Filters
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string>(ALL);
  const [marital, setMarital] = useState<string>(ALL);
  const [edu, setEdu] = useState<string>(ALL);
  const [minExp, setMinExp] = useState("");
  const [maxExp, setMaxExp] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<string>("_rowIndex");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Detail
  const [selected, setSelected] = useState<Application | null>(null);

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setSyncing(true);
      const next = await fetchApplications();
      const newOnes = next.filter((a) => !seenIds.current.has(a._id));
      if (isFirst.current) {
        next.forEach((a) => seenIds.current.add(a._id));
        isFirst.current = false;
        setApps(next);
      } else if (newOnes.length > 0) {
        newOnes.forEach((a) => seenIds.current.add(a._id));
        setApps(next);
        toast.success(`${newOnes.length} new submission${newOnes.length > 1 ? "s" : ""} loaded`, {
          icon: <Sparkles className="h-4 w-4" />,
        });
      } else {
        setApps(next);
      }
      setLastSynced(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unique = (key: string) =>
    Array.from(new Set(apps.map((a) => (a as any)[key]).filter(Boolean))).sort();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minExp ? Number(minExp) : null;
    const max = maxExp ? Number(maxExp) : null;
    return apps.filter((a) => {
      if (q && !COLUMNS.some((c) => (a[c] || "").toLowerCase().includes(q))) return false;
      if (city !== ALL && a.City !== city) return false;
      if (marital !== ALL && a.MaritalStatus !== marital) return false;
      if (edu !== ALL && a.HighestEducation !== edu) return false;
      const expNum = Number(a.WorkExperienceYears);
      if (min !== null && !isNaN(min) && (isNaN(expNum) || expNum < min)) return false;
      if (max !== null && !isNaN(max) && (isNaN(expNum) || expNum > max)) return false;
      return true;
    });
  }, [apps, search, city, marital, edu, minExp, maxExp]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      const an = Number(av);
      const bn = Number(bv);
      let cmp = 0;
      if (!isNaN(an) && !isNaN(bn) && av !== "" && bv !== "") cmp = an - bn;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, city, marital, edu, minExp, maxExp, pageSize]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ k }: { k: string }) =>
    sortKey !== k ? (
      <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success("Phone number copied");
  };

  const reset = () => {
    setSearch("");
    setCity(ALL);
    setMarital(ALL);
    setEdu(ALL);
    setMinExp("");
    setMaxExp("");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Toaster position="top-right" richColors />
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Applications Portal</h1>
            <p className="text-sm text-muted-foreground">
              Live view of applications synced from Google Sheets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    error ? "bg-destructive" : syncing ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                  }`}
                />
                {error ? "Sync error" : syncing ? "Syncing…" : "Connected"}
              </div>
              <div>
                Last synced:{" "}
                {lastSynced ? lastSynced.toLocaleTimeString() : "—"}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => load()} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Applications" value={apps.length} />
          <StatCard label="Filtered Results" value={sorted.length} />
          <StatCard label="Unique Cities" value={unique("City").length} />
          <StatCard
            label="Poll Interval"
            value={`${Math.round(POLL_INTERVAL_MS / 1000)}s`}
          />
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-lg border bg-background p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <Input
                placeholder="Search across all fields…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger><SelectValue placeholder="City" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All cities</SelectItem>
                {unique("City").map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={marital} onValueChange={setMarital}>
              <SelectTrigger><SelectValue placeholder="Marital Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {unique("MaritalStatus").map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={edu} onValueChange={setEdu}>
              <SelectTrigger><SelectValue placeholder="Education" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All education</SelectItem>
                {unique("HighestEducation").map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min exp"
                value={minExp}
                onChange={(e) => setMinExp(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max exp"
                value={maxExp}
                onChange={(e) => setMaxExp(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing {paged.length} of {sorted.length}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset filters
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {COLUMNS.map((c) => (
                    <TableHead
                      key={c}
                      className="cursor-pointer whitespace-nowrap select-none"
                      onClick={() => toggleSort(c)}
                    >
                      {c}
                      <SortIcon k={c} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="h-32 text-center text-muted-foreground">
                      Loading applications…
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="h-32 text-center text-destructive">
                      {error} — <button className="underline" onClick={() => load()}>retry</button>
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="h-32 text-center text-muted-foreground">
                      No applications match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((a) => (
                    <TableRow
                      key={a._id}
                      className="cursor-pointer"
                      onClick={() => setSelected(a)}
                    >
                      {COLUMNS.map((c) => (
                        <TableCell key={c} className="whitespace-nowrap">
                          {c === "MaritalStatus" && a[c] ? (
                            <Badge variant="secondary">{a[c]}</Badge>
                          ) : (
                            a[c] || <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 md:flex-row">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Rows per page
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {safePage} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.FullName || "Application details"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COLUMNS.map((c) => (
                  <div key={c} className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {c}
                    </div>
                    <div className="mt-1 break-words text-sm">
                      {selected[c] || <span className="text-muted-foreground">—</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => copyPhone(selected.PhoneNumber)}
                  disabled={!selected.PhoneNumber}
                >
                  <Copy className="h-4 w-4" />
                  Copy Phone Number
                </Button>
                <Button onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
