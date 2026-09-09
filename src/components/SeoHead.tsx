import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeoPage, routeSeoPage, type SeoPage } from '@/src/lib/seo';

export function SeoHead({ page }: { page: SeoPage }) {
  useEffect(() => {
    applySeoPage(page);
  }, [page.title, page.description, page.pathname, page.image, page.imageAlt, page.indexable, page.type]);
  return null;
}

export function RouteSeoHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    applySeoPage(routeSeoPage(pathname));
  }, [pathname]);
  return null;
}
