import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface GuestCartItem {
  variantId: string;
  quantity: number;
}

interface GuestCartState {
  mergeId: string;
  items: GuestCartItem[];
}

interface GuestCartContextValue extends GuestCartState {
  addItem: (variantId: string, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "forma.guest-cart.v1";

const GuestCartContext = createContext<GuestCartContextValue | null>(null);

function createEmptyCart(): GuestCartState {
  return {
    mergeId: crypto.randomUUID(),
    items: [],
  };
}

function readGuestCart(): GuestCartState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return createEmptyCart();
    }

    const value: unknown = JSON.parse(stored);

    if (
      !value ||
      typeof value !== "object" ||
      !("mergeId" in value) ||
      !("items" in value) ||
      typeof value.mergeId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(value.mergeId) ||
      !Array.isArray(value.items)
    ) {
      return createEmptyCart();
    }

    const seen = new Set<string>();

    const items: GuestCartItem[] = [];

    for (const entry of value.items.slice(0, 30)) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.variantId !== "string" ||
        !/^[a-fA-F0-9]{24}$/.test(entry.variantId) ||
        !Number.isInteger(entry.quantity) ||
        entry.quantity < 1 ||
        entry.quantity > 20
      ) {
        continue;
      }

      const id = entry.variantId.toLowerCase();

      if (seen.has(id)) {
        continue;
      }

      seen.add(id);

      items.push({
        variantId: id,
        quantity: entry.quantity,
      });
    }

    return {
      mergeId: value.mergeId,
      items,
    };
  } catch {
    return createEmptyCart();
  }
}

export function GuestCartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<GuestCartState>(readGuestCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const value = useMemo<GuestCartContextValue>(
    () => ({
      ...cart,

      addItem(variantId, quantity) {
        setCart((previous) => {
          const existing = previous.items.find(
            (item) => item.variantId === variantId,
          );

          const combined = Math.min(20, (existing?.quantity ?? 0) + quantity);

          const items = existing
            ? previous.items.map((item) =>
                item.variantId === variantId
                  ? { ...item, quantity: combined }
                  : item,
              )
            : previous.items.length >= 30
              ? previous.items
              : [...previous.items, { variantId, quantity }];

          return { ...previous, items };
        });
      },

      setQuantity(variantId, quantity) {
        setCart((previous) => ({
          ...previous,
          items: previous.items.map((item) =>
            item.variantId === variantId
              ? {
                  ...item,
                  quantity: Math.max(1, Math.min(20, quantity)),
                }
              : item,
          ),
        }));
      },

      removeItem(variantId) {
        setCart((previous) => ({
          ...previous,
          items: previous.items.filter((item) => item.variantId !== variantId),
        }));
      },

      clear() {
        setCart(createEmptyCart());
      },
    }),
    [cart],
  );

  return (
    <GuestCartContext.Provider value={value}>
      {children}
    </GuestCartContext.Provider>
  );
}

export function useGuestCart() {
  const context = useContext(GuestCartContext);

  if (!context) {
    throw new Error("useGuestCart must be used inside GuestCartProvider");
  }

  return context;
}
