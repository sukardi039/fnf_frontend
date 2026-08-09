import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import { AuthContext } from "../../context/authContext";
import {
  listTransformationRecipes,
  createTransformation,
} from "../../helpers/transformation_helper";
import { listInventorySnapshots } from "../../helpers/inventory_helper";
import { listStores } from "../../helpers/store_helper";

export default function TransformationBatchRun() {
  const { t } = useTranslation();
  const { userInfo } = useContext(AuthContext);
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.recipeId === selectedRecipeId) || null,
    [recipes, selectedRecipeId],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [storesResponse, recipesResponse] = await Promise.all([
          listStores({ companyId: userInfo?.companyId, active: true }),
          listTransformationRecipes({
            companyId: userInfo?.companyId,
            active: true,
          }),
        ]);
        const storeItems = Array.isArray(storesResponse.data?.items)
          ? storesResponse.data.items
          : Array.isArray(storesResponse.data)
            ? storesResponse.data
            : [];
        const recipeItems = Array.isArray(recipesResponse.data?.items)
          ? recipesResponse.data.items
          : [];
        if (!active) return;
        setStores(storeItems);
        setRecipes(recipeItems);
        if (storeItems.length === 1) {
          setSelectedStoreId(
            String(storeItems[0].storeId || storeItems[0].id || ""),
          );
        }
      } catch (err) {
        if (!active) return;
        setError(
          err?.response?.data?.message || t("transformationBatch.loadFailed"),
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [t, userInfo?.companyId]);

  useEffect(() => {
    let active = true;
    const loadSnapshots = async () => {
      if (!selectedStoreId) {
        setSnapshots([]);
        return;
      }
      try {
        const response = await listInventorySnapshots({
          storeId: selectedStoreId,
          includeLots: true,
          pageSize: 500,
        });
        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        if (!active) return;
        setSnapshots(items);
      } catch (err) {
        if (!active) return;
        setError(
          err?.response?.data?.message ||
            t("transformationBatch.loadSnapshotsFailed"),
        );
      }
    };

    loadSnapshots();
    return () => {
      active = false;
    };
  }, [t, selectedStoreId]);

  const lotOptions = useMemo(() => {
    const options = [];
    snapshots.forEach((snapshot) => {
      (snapshot.lots || []).forEach((lot) => {
        options.push({
          lotId: lot.lotId,
          skuId: snapshot.skuId,
          productName: snapshot.productName,
          availableQuantity: lot.availableQuantity,
          uom: snapshot.uom,
        });
      });
    });
    return options;
  }, [snapshots]);

  const initializeBatchRows = (recipe) => {
    if (!recipe) {
      setInputs([]);
      setOutputs([]);
      return;
    }
    setInputs(
      recipe.inputSkuIds.map((skuId) => ({
        skuId,
        lotId: "",
        quantity: "",
        uom: recipe.inputUom || "",
      })),
    );
    setOutputs(
      recipe.outputs.map((output) => ({
        skuId: output.skuId,
        quantity: "",
        uom: recipe.inputUom || "",
      })),
    );
  };

  const updateInput = (index, field, value) => {
    setInputs((prev) =>
      prev.map((row, idx) =>
        idx === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const updateOutput = (index, field, value) => {
    setOutputs((prev) =>
      prev.map((row, idx) =>
        idx === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const removeInput = (index) => {
    setInputs((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addOutput = () => {
    setOutputs((prev) => [...prev, { skuId: "", quantity: "", uom: "" }]);
  };

  const removeOutput = (index) => {
    setOutputs((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validate = () => {
    if (!selectedRecipeId) return false;
    if (!selectedStoreId) return false;
    if (
      inputs.some(
        (row) => !row.lotId || !row.quantity || Number(row.quantity) <= 0,
      )
    ) {
      return false;
    }
    if (
      outputs.some(
        (row) => !row.skuId || !row.quantity || Number(row.quantity) <= 0,
      )
    ) {
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      setError(t("transformationBatch.validationError"));
      return;
    }
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const response = await createTransformation({
        recipeId: selectedRecipeId,
        storeId: selectedStoreId,
        inputs: inputs.map((row) => ({
          lotId: row.lotId,
          skuId: row.skuId,
          quantity: Number(row.quantity),
          uom: row.uom,
        })),
        outputs: outputs.map((row) => ({
          skuId: row.skuId,
          quantity: Number(row.quantity),
          uom: row.uom,
        })),
      });
      setResult(response.data);
    } catch (err) {
      setError(
        err?.response?.data?.message || t("transformationBatch.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message={t("common.loading")} />;
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t("transformationBatch.title")}
        subtitle={t("transformationBatch.subtitle")}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("transformationBatch.created", {
            transformationId: result.transformationId,
            status: result.status,
          })}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          mb: 3,
          maxWidth: 880,
        }}
      >
        <FormControl fullWidth required>
          <InputLabel id="batch-store-label">
            {t("transformationBatch.store")}
          </InputLabel>
          <Select
            labelId="batch-store-label"
            value={selectedStoreId}
            label={t("transformationBatch.store")}
            onChange={(e) => setSelectedStoreId(e.target.value)}
          >
            {stores.map((store) => (
              <MenuItem
                key={store.storeId || store.id}
                value={String(store.storeId || store.id)}
              >
                {store.storeName || store.name || store.storeId || store.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth required>
          <InputLabel id="batch-recipe-label">
            {t("transformationBatch.recipe")}
          </InputLabel>
          <Select
            labelId="batch-recipe-label"
            value={selectedRecipeId}
            label={t("transformationBatch.recipe")}
            onChange={(e) => {
              const recipeId = e.target.value;
              const recipe =
                recipes.find((r) => r.recipeId === recipeId) || null;
              setSelectedRecipeId(recipeId);
              initializeBatchRows(recipe);
            }}
          >
            {recipes.map((recipe) => (
              <MenuItem key={recipe.recipeId} value={recipe.recipeId}>
                {recipe.recipeName} (rev {recipe.revision})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {selectedRecipe && (
        <Box sx={{ mb: 2 }}>
          <Chip
            label={`${t("transformationBatch.inputUom")}: ${selectedRecipe.inputUom}`}
            sx={{ mr: 1 }}
          />
          <Chip
            label={`${t("transformationBatch.yieldRange")}: ${Math.round(selectedRecipe.expectedYieldMin * 100)}% - ${Math.round(selectedRecipe.expectedYieldMax * 100)}%`}
          />
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t("transformationBatch.inputs")}
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("transformationBatch.sku")}</TableCell>
              <TableCell>{t("transformationBatch.lot")}</TableCell>
              <TableCell>{t("transformationBatch.quantity")}</TableCell>
              <TableCell>{t("transformationBatch.uom")}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {inputs.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.skuId}</TableCell>
                <TableCell>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t("transformationBatch.lot")}</InputLabel>
                    <Select
                      value={row.lotId}
                      label={t("transformationBatch.lot")}
                      onChange={(e) =>
                        updateInput(index, "lotId", e.target.value)
                      }
                    >
                      {lotOptions
                        .filter((lot) => lot.skuId === row.skuId)
                        .map((lot) => (
                          <MenuItem key={lot.lotId} value={lot.lotId}>
                            {lot.lotId} ({t("transformationBatch.available")}:{" "}
                            {lot.availableQuantity} {lot.uom})
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={row.quantity}
                    onChange={(e) =>
                      updateInput(index, "quantity", e.target.value)
                    }
                    inputProps={{ min: 0.001, step: "0.001" }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.uom}
                    inputProps={{ readOnly: true }}
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => removeInput(index)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t("transformationBatch.outputs")}
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("transformationBatch.sku")}</TableCell>
              <TableCell>{t("transformationBatch.quantity")}</TableCell>
              <TableCell>{t("transformationBatch.uom")}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {outputs.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.skuId}
                    onChange={(e) =>
                      updateOutput(index, "skuId", e.target.value)
                    }
                    placeholder={t("transformationBatch.sku")}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={row.quantity}
                    onChange={(e) =>
                      updateOutput(index, "quantity", e.target.value)
                    }
                    inputProps={{ min: 0.001, step: "0.001" }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.uom}
                    onChange={(e) => updateOutput(index, "uom", e.target.value)}
                    placeholder={t("transformationBatch.uom")}
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => removeOutput(index)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Button variant="outlined" onClick={addOutput} sx={{ mb: 2, mr: 2 }}>
        {t("transformationBatch.addOutput")}
      </Button>
      <Button
        type="submit"
        variant="contained"
        disabled={saving || !validate()}
      >
        {saving ? t("common.saving") : t("transformationBatch.run")}
      </Button>
    </Box>
  );
}
