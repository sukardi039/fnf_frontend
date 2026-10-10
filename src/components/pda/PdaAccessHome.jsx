import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function PdaAccessHome() {
  const { search } = useLocation();
  return <Navigate to={`/pda/pickup${search}`} replace />;
}
