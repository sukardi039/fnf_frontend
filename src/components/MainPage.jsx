import React from "react";
import { Routes, Route } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import AppHome from "./AppHome";
import CompanyModern from "./baseInformation/CompanyModern";
import RoleModern from "./baseInformation/RoleModern";
import StaffModern from "./baseInformation/StaffModern";
import UserRoleModern from "./baseInformation/UserRoleModern";
import UserModern from "./baseInformation/UserModern";
import LanguageSettings from "./baseInformation/LanguageSettings";
import UserProfile from "./baseInformation/UserProfile";
import Settings from "./baseInformation/Settings";
import EulaPage from "./information/EulaPage";
import PrivacyPage from "./information/PrivacyPage";
import UserLoginList from "./baseInformation/UserLoginList";
import ForcedPassword from "./baseInformation/ForcedPassword";
import QrGenerator from "./baseInformation/QrGenerator";
import ParameterModern from "./baseInformation/ParameterModern";
import WASimulator from "./baseInformation/WASimulator";
import ProductCatalog from "./catalog/ProductCatalog";
import PriceRuleForm from "./catalog/PriceRuleForm";
import SkuLabelGenerator from "./catalog/SkuLabelGenerator";
import PurchaseLotReceive from "./inventory/PurchaseLotReceive";
import LossEventForm from "./inventory/LossEventForm";
import StaffCheckout from "./checkout/StaffCheckout";
import RefundRequestForm from "./checkout/RefundRequestForm";
import RefundApprovalForm from "./checkout/RefundApprovalForm";
import TransformationRecipeForm from "./transformation/TransformationRecipeForm";

function MainPage() {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AppHome />} />
        <Route path="/home" element={<AppHome />} />
        <Route path="/company" element={<CompanyModern />} />
        <Route path="/role" element={<RoleModern />} />
        <Route path="/staff" element={<StaffModern />} />
        <Route path="/user" element={<UserModern />} />
        <Route path="/userRole" element={<UserRoleModern />} />
        <Route path="/userlogin" element={<UserLoginList />} />
        <Route path="/forced-password" element={<ForcedPassword />} />
        <Route path="/language-settings" element={<LanguageSettings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/about/eula" element={<EulaPage />} />
        <Route path="/about/privacy" element={<PrivacyPage />} />
        <Route path="/qr-generator" element={<QrGenerator />} />
        <Route path="/parameter" element={<ParameterModern />} />
        <Route path="/wa-simulator" element={<WASimulator />} />
        <Route path="/product" element={<ProductCatalog />} />
        <Route path="/price-rules/new" element={<PriceRuleForm />} />
        <Route path="/catalog/labels" element={<SkuLabelGenerator />} />
        <Route
          path="/inventory/lots/receive"
          element={<PurchaseLotReceive />}
        />
        <Route path="/inventory/loss-events/new" element={<LossEventForm />} />
        <Route path="/checkout/staff" element={<StaffCheckout />} />
        <Route path="/checkout/refunds/new" element={<RefundRequestForm />} />
        <Route
          path="/checkout/refunds/approve"
          element={<RefundApprovalForm />}
        />
        <Route
          path="/transformations/recipes/new"
          element={<TransformationRecipeForm />}
        />
      </Routes>
    </AdminLayout>
  );
}

export default MainPage;
