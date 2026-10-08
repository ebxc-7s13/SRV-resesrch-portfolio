"use client";
import { createContext, useContext } from "react";
export type ContentValues = Record<string, string>;
const ContentContext = createContext<ContentValues>({});
export function SiteContentProvider({
  values,
  children,
}: {
  values: ContentValues;
  children: React.ReactNode;
}) {
  return (
    <ContentContext.Provider value={values}>{children}</ContentContext.Provider>
  );
}
export function useSiteValue(page: string, name: string): string | undefined {
  const values = useContext(ContentContext);
  return values[`${page}.${name}`];
}
export function SiteText({
  page,
  name,
  children,
}: {
  page: string;
  name: string;
  children?: React.ReactNode;
}) {
  const values = useContext(ContentContext);
  return <>{values[`${page}.${name}`] ?? children}</>;
}
