import { createContext, useContext } from "react";

export const StoreLocationContext = createContext(null);

export const useStoreLocation = () => {
  const context = useContext(StoreLocationContext);
  if (!context) {
    throw new Error("Store-related screens must be rendered inside StoreScope");
  }
  return context;
};
