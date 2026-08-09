import React from "react";
import { Routes, Route } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import AppHome from "./AppHome";
import CompanyModern from "./baseInformation/CompanyModern";
import RoleModern from "./baseInformation/RoleModern";
import StaffModern from "./baseInformation/StaffModern";
import UserRoleModern from "./baseInformation/UserRoleModern";
import UserModern from "./baseInformation/UserModern";
import StoreModern from "./baseInformation/StoreModern";
import VendorModern from "./baseInformation/VendorModern";
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
import UomList from "./catalog/UomList";
import UomConversionList from "./catalog/UomConversionList";
import PurchaseLotReceive from "./inventory/PurchaseLotReceive";
import LossEventForm from "./inventory/LossEventForm";
import StockView from "./inventory/StockView";
import StaffCheckout from "./checkout/StaffCheckout";
import RefundRequestForm from "./checkout/RefundRequestForm";
import RefundApprovalForm from "./checkout/RefundApprovalForm";
import TransformationRecipeForm from "./transformation/TransformationRecipeForm";
import TransformationRecipeList from "./transformation/TransformationRecipeList";
import TransformationBatchRun from "./transformation/TransformationBatchRun";
import TransformationList from "./transformation/TransformationList";
import TransformationApprovalList from "./transformation/TransformationApprovalList";
import DailySummary from "./reporting/DailySummary";
import Reconciliation from "./reporting/Reconciliation";
import PlaceholderPage from "./common/PlaceholderPage";
import {
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  Inventory as InventoryIcon,
  History as HistoryIcon,
  ThumbUp as ThumbUpIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";

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
        <Route path="/store" element={<StoreModern />} />
        <Route path="/vendor" element={<VendorModern />} />
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
        <Route path="/catalog/uoms" element={<UomList />} />
        <Route
          path="/catalog/uom-conversions"
          element={<UomConversionList />}
        />
        <Route
          path="/inventory/lots/receive"
          element={<PurchaseLotReceive />}
        />
        <Route path="/inventory/loss-events/new" element={<LossEventForm />} />
        <Route path="/inventory/stock-view" element={<StockView />} />
        <Route path="/checkout/staff" element={<StaffCheckout />} />
        <Route path="/checkout/refunds/new" element={<RefundRequestForm />} />
        <Route
          path="/checkout/refunds/approve"
          element={<RefundApprovalForm />}
        />
        <Route
          path="/transformations/recipes"
          element={<TransformationRecipeList />}
        />
        <Route
          path="/transformations/recipes/new"
          element={<TransformationRecipeForm />}
        />
        <Route
          path="/transformations/batches"
          element={<TransformationList />}
        />
        <Route
          path="/transformations/batches/new"
          element={<TransformationBatchRun />}
        />
        <Route
          path="/transformations/approvals"
          element={<TransformationApprovalList />}
        />
        <Route path="/reports/daily-summary" element={<DailySummary />} />
        <Route path="/reports/reconciliation" element={<Reconciliation />} />
        <Route
          path="/inventory/loss-approvals"
          element={
            <PlaceholderPage
              titleKey="placeholder.lossApprovalsTitle"
              descriptionKey="placeholder.lossApprovalsDescription"
              icon={ThumbUpIcon}
            />
          }
        />
        <Route
          path="/inventory/movements"
          element={
            <PlaceholderPage
              titleKey="placeholder.inventoryMovementsTitle"
              descriptionKey="placeholder.inventoryMovementsDescription"
              icon={HistoryIcon}
            />
          }
        />
        <Route
          path="/checkout/payments"
          element={
            <PlaceholderPage
              titleKey="placeholder.paymentDashboardTitle"
              descriptionKey="placeholder.paymentDashboardDescription"
              icon={PaymentIcon}
            />
          }
        />
        <Route
          path="/reports/loss"
          element={
            <PlaceholderPage
              titleKey="placeholder.lossReportTitle"
              descriptionKey="placeholder.lossReportDescription"
              icon={WarningIcon}
            />
          }
        />
        <Route
          path="/reports/recovery"
          element={
            <PlaceholderPage
              titleKey="placeholder.recoveryReportTitle"
              descriptionKey="placeholder.recoveryReportDescription"
              icon={TrendingUpIcon}
            />
          }
        />
        <Route
          path="/reports/payment-settlement"
          element={
            <PlaceholderPage
              titleKey="placeholder.paymentSettlementTitle"
              descriptionKey="placeholder.paymentSettlementDescription"
              icon={AccountBalanceIcon}
            />
          }
        />
        <Route
          path="/reports/inventory"
          element={
            <PlaceholderPage
              titleKey="placeholder.inventoryReportTitle"
              descriptionKey="placeholder.inventoryReportDescription"
              icon={InventoryIcon}
            />
          }
        />
      </Routes>
    </AdminLayout>
  );
}

export default MainPage;
