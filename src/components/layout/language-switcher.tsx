
'use client';

import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-muted">
      <Button
        size="sm"
        variant={language === 'ko' ? 'default' : 'ghost'}
        className={cn(
            "rounded-full transition-all px-3 py-1 h-auto text-xs",
            language === 'ko' && 'shadow-sm'
        )}
        onClick={() => setLanguage('ko')}
      >
        KO
      </Button>
      <Button
        size="sm"
        variant={language === 'vi' ? 'default' : 'ghost'}
        className={cn(
            "rounded-full transition-all px-3 py-1 h-auto text-xs",
            language === 'vi' && 'shadow-sm'
        )}
        onClick={() => setLanguage('vi')}
      >
        VI
      </Button>
    </div>
  );
}
