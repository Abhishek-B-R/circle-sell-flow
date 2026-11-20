import { Armchair, Bike, Book, Camera, Car, Gamepad2, Headphones, Laptop, Package, Refrigerator, Shirt, Smartphone, Sofa, Tablet, Tv, Watch, type LucideIcon } from "lucide-react";
import type { CATEGORY_ICONS } from "@/lib/fields/definition-schema";

export const ICONS: Record<(typeof CATEGORY_ICONS)[number], LucideIcon> = {
  smartphone: Smartphone,
  laptop: Laptop,
  sofa: Sofa,
  tablet: Tablet,
  watch: Watch,
  headphones: Headphones,
  camera: Camera,
  gamepad: Gamepad2,
  tv: Tv,
  bike: Bike,
  car: Car,
  shirt: Shirt,
  book: Book,
  refrigerator: Refrigerator,
  armchair: Armchair,
  package: Package,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Package;
  return <Icon className={className} strokeWidth={1.75} />;
}
