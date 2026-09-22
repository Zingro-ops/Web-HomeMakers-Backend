import { useEffect, useState } from "react";
import api from "../services/api";

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/v1/categories", { params: { limit: 100 } })
      .then(({ data }) => setCategories(data?.data?.items || []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}
