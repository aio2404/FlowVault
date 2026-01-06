'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Search,
  GitBranch,
  Server,
  AlertCircle,
  Clock,
  Loader2,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { workflowApi, instanceApi } from '@/lib/api';

interface SearchResult {
  type: 'workflow' | 'instance' | 'version';
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'secondary';
  href: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const { token, organizationId } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search function
  const search = useCallback(async (q: string) => {
    if (!q.trim() || !token || !organizationId) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];
      
      // Search workflows
      const workflows = await workflowApi.list(token, organizationId, { search: q });
      workflows.forEach((wf) => {
        searchResults.push({
          type: 'workflow',
          id: wf.id,
          title: wf.name,
          subtitle: `${wf.instanceName} • ${wf.versionCount} versions`,
          badge: wf.active ? 'Active' : 'Inactive',
          badgeVariant: wf.active ? 'success' : 'secondary',
          href: `/app/workflows/${wf.id}`,
        });
      });

      // Search instances
      const instances = await instanceApi.list(token, organizationId);
      instances
        .filter((inst) => 
          inst.name.toLowerCase().includes(q.toLowerCase()) ||
          inst.baseUrl.toLowerCase().includes(q.toLowerCase())
        )
        .forEach((inst) => {
          searchResults.push({
            type: 'instance',
            id: inst.id,
            title: inst.name,
            subtitle: inst.baseUrl,
            badge: inst.status,
            badgeVariant: inst.status === 'connected' ? 'success' : 'warning',
            href: `/app/instances`,
          });
        });

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            router.push(results[selectedIndex].href);
            onOpenChange(false);
            setQuery('');
          }
          break;
        case 'Escape':
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex, router, onOpenChange]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const icons = {
    workflow: GitBranch,
    instance: Server,
    version: Clock,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>
        
        {/* Search input */}
        <div className="flex items-center border-b px-4 py-3">
          <Search className="w-5 h-5 text-muted-foreground mr-3" />
          <Input
            ref={inputRef}
            placeholder="Search workflows, instances..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 p-0 h-auto text-base placeholder:text-muted-foreground/60"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-auto">
          {query && results.length === 0 && !loading && (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No results found for &quot;{query}&quot;</p>
            </div>
          )}

          {!query && (
            <div className="p-8 text-center text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Start typing to search...</p>
              <p className="text-xs mt-2">
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑</kbd>{' '}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↓</kbd> to navigate,{' '}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to select
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((result, index) => {
                const Icon = icons[result.type];
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      selectedIndex === index ? 'bg-primary/10' : 'hover:bg-muted/50'
                    )}
                    onClick={() => {
                      router.push(result.href);
                      onOpenChange(false);
                      setQuery('');
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded flex items-center justify-center',
                      result.type === 'workflow' ? 'bg-primary/10 text-primary' :
                      result.type === 'instance' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    {result.badge && (
                      <Badge variant={result.badgeVariant || 'default'} className="shrink-0">
                        {result.badge}
                      </Badge>
                    )}
                    <ChevronRight className={cn(
                      'w-4 h-4 text-muted-foreground transition-opacity',
                      selectedIndex === index ? 'opacity-100' : 'opacity-0'
                    )} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">K</kbd>
              to open
            </span>
          </div>
          <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}



