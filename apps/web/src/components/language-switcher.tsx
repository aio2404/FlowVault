'use client';

import { useLanguage } from '@/lib/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Languages className="w-4 h-4 opacity-70" />
      <Select value={locale} onValueChange={(value) => setLocale(value as 'en' | 'fr')}>
        <SelectTrigger className="h-8 w-[120px]">
          <SelectValue placeholder={t('language.label')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="fr">Français</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
