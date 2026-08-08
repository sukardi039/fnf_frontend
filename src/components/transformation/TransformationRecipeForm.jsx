import React, { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { HeaderBar, LoadingState } from "../common";
import { fetchActiveProducts } from "../catalog/productApi";
import { request } from "../../helpers/axios_helper";

const RECIPE_TYPES = ["WHOLE_TO_CUT", "WHOLE_TO_JUICE"];
const emptyOutput = () => ({
  skuId: "",
  allocationWeight: "",
  yieldConversionFactor: "",
});

const TransformationRecipeForm = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [recipe, setRecipe] = useState(null);
  const [form, setForm] = useState({
    companyId: "",
    recipeName: "",
    revision: "1",
    type: "WHOLE_TO_CUT",
    inputSkuIds: [""],
    outputs: [emptyOutput()],
    expectedYieldMin: "",
    expectedYieldMax: "",
    expectedWasteMin: "",
    expectedWasteMax: "",
  });

  useEffect(() => {
    let active = true;
    fetchActiveProducts()
      .then((response) => {
        if (active) {
          setProducts(
            Array.isArray(response.data?.items) ? response.data.items : [],
          );
        }
      })
      .catch(() => {
        if (active) setError(t("transformationRecipe.productsUnavailable"));
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const selectedInputs = form.inputSkuIds.filter(Boolean);
  const inputUom =
    products.find((product) => product.skuId === selectedInputs[0])?.uom || "";
  const outputFormat = form.type === "WHOLE_TO_CUT" ? "CUT" : "JUICE";
  const inputProducts = products.filter(
    (product) =>
      product.format === "WHOLE" && (!inputUom || product.uom === inputUom),
  );
  const outputProducts = products.filter(
    (product) => product.format === outputFormat,
  );
  const selectedOutputs = form.outputs
    .map((output) => output.skuId)
    .filter(Boolean);

  const clearResult = () => {
    setError("");
    setRecipe(null);
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "type" ? { outputs: [emptyOutput()] } : {}),
    }));
    setErrors((current) => ({ ...current, [name]: "" }));
    clearResult();
  };

  const updateInput = (index, value) => {
    setForm((current) => ({
      ...current,
      inputSkuIds: current.inputSkuIds.map((skuId, rowIndex) =>
        rowIndex === index ? value : skuId,
      ),
    }));
    setErrors((current) => ({ ...current, inputSkuIds: "" }));
    clearResult();
  };

  const updateOutput = (index, field, value) => {
    setForm((current) => ({
      ...current,
      outputs: current.outputs.map((output, rowIndex) =>
        rowIndex === index ? { ...output, [field]: value } : output,
      ),
    }));
    setErrors((current) => ({ ...current, outputs: "" }));
    clearResult();
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.companyId.trim())
      nextErrors.companyId = t(
        "transformationRecipe.validation.companyRequired",
      );
    if (!form.recipeName.trim())
      nextErrors.recipeName = t("transformationRecipe.validation.nameRequired");
    if (!Number.isInteger(Number(form.revision)) || Number(form.revision) < 1)
      nextErrors.revision = t(
        "transformationRecipe.validation.revisionInvalid",
      );
    if (form.inputSkuIds.some((skuId) => !skuId))
      nextErrors.inputSkuIds = t(
        "transformationRecipe.validation.inputsRequired",
      );
    if (
      form.outputs.some(
        (output) =>
          !output.skuId ||
          Number(output.allocationWeight) <= 0 ||
          Number(output.allocationWeight) > 1 ||
          Number(output.yieldConversionFactor) <= 0,
      )
    )
      nextErrors.outputs = t("transformationRecipe.validation.outputsInvalid");

    const rangeFields = [
      "expectedYieldMin",
      "expectedYieldMax",
      "expectedWasteMin",
      "expectedWasteMax",
    ];
    rangeFields.forEach((field) => {
      if (
        form[field] === "" ||
        Number(form[field]) < 0 ||
        Number(form[field]) > 1
      )
        nextErrors[field] = t("transformationRecipe.validation.rangeInvalid");
    });
    if (Number(form.expectedYieldMin) > Number(form.expectedYieldMax))
      nextErrors.expectedYieldMax = t(
        "transformationRecipe.validation.maxBelowMin",
      );
    if (Number(form.expectedWasteMin) > Number(form.expectedWasteMax))
      nextErrors.expectedWasteMax = t(
        "transformationRecipe.validation.maxBelowMin",
      );
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    clearResult();
    try {
      const response = await request(
        "POST",
        "/api/transformation-recipes",
        {
          companyId: form.companyId.trim(),
          recipeName: form.recipeName.trim(),
          revision: Number(form.revision),
          type: form.type,
          inputUom,
          inputSkuIds: form.inputSkuIds,
          outputs: form.outputs.map((output) => ({
            skuId: output.skuId,
            allocationWeight: Number(output.allocationWeight),
            yieldConversionFactor: Number(output.yieldConversionFactor),
          })),
          expectedYieldMin: Number(form.expectedYieldMin),
          expectedYieldMax: Number(form.expectedYieldMax),
          expectedWasteMin: Number(form.expectedWasteMin),
          expectedWasteMax: Number(form.expectedWasteMax),
        },
        {
          headers: { "Idempotency-Key": crypto.randomUUID() },
          skipAuthRedirect: true,
          skipBackendErrorDialog: true,
        },
      );
      setRecipe(response.data);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          t("transformationRecipe.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingProducts)
    return <LoadingState message={t("transformationRecipe.loadingProducts")} />;

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <HeaderBar
        title={t("transformationRecipe.title")}
        subtitle={t("transformationRecipe.subtitle")}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: 880 }}>
          {error}
        </Alert>
      )}
      {recipe && (
        <Alert severity="success" sx={{ mb: 2, maxWidth: 880 }}>
          {t("transformationRecipe.created", recipe)}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          maxWidth: 880,
        }}
      >
        <TextField
          label={t("transformationRecipe.companyId")}
          name="companyId"
          value={form.companyId}
          onChange={handleFieldChange}
          error={Boolean(errors.companyId)}
          helperText={errors.companyId}
          required
        />
        <TextField
          label={t("transformationRecipe.recipeName")}
          name="recipeName"
          value={form.recipeName}
          onChange={handleFieldChange}
          inputProps={{ maxLength: 200 }}
          error={Boolean(errors.recipeName)}
          helperText={errors.recipeName}
          required
        />
        <TextField
          label={t("transformationRecipe.revision")}
          name="revision"
          type="number"
          value={form.revision}
          onChange={handleFieldChange}
          inputProps={{ min: 1, step: 1 }}
          error={Boolean(errors.revision)}
          helperText={errors.revision}
          required
        />
        <TextField
          select
          label={t("transformationRecipe.type")}
          name="type"
          value={form.type}
          onChange={handleFieldChange}
        >
          {RECIPE_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {t(`transformationRecipe.types.${type}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t("transformationRecipe.inputUom")}
          value={inputUom}
          disabled
          required
        />
      </Box>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        {t("transformationRecipe.inputs")}
      </Typography>
      {form.inputSkuIds.map((skuId, index) => (
        <Box key={index} sx={{ display: "flex", gap: 1, mb: 1, maxWidth: 880 }}>
          <TextField
            select
            label={t("transformationRecipe.inputSku")}
            value={skuId}
            onChange={(event) => updateInput(index, event.target.value)}
            error={Boolean(errors.inputSkuIds)}
            helperText={index === 0 ? errors.inputSkuIds : ""}
            required
            fullWidth
          >
            {inputProducts
              .filter(
                (product) =>
                  product.skuId === skuId ||
                  !selectedInputs.includes(product.skuId),
              )
              .map((product) => (
                <MenuItem key={product.skuId} value={product.skuId}>
                  {product.productName} ({product.productCode})
                </MenuItem>
              ))}
          </TextField>
          <Tooltip title={t("transformationRecipe.removeInput")}>
            <span>
              <IconButton
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    inputSkuIds: current.inputSkuIds.filter(
                      (_, rowIndex) => rowIndex !== index,
                    ),
                  }))
                }
                disabled={form.inputSkuIds.length === 1}
              >
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ))}
      <Button
        startIcon={<AddIcon />}
        onClick={() =>
          setForm((current) => ({
            ...current,
            inputSkuIds: [...current.inputSkuIds, ""],
          }))
        }
        disabled={
          selectedInputs.length < form.inputSkuIds.length ||
          selectedInputs.length >= inputProducts.length
        }
      >
        {t("transformationRecipe.addInput")}
      </Button>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        {t("transformationRecipe.outputs")}
      </Typography>
      {form.outputs.map((output, index) => (
        <Box
          key={index}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr auto" },
            gap: 1,
            mb: 1,
            maxWidth: 880,
          }}
        >
          <TextField
            select
            label={t("transformationRecipe.outputSku")}
            value={output.skuId}
            onChange={(event) =>
              updateOutput(index, "skuId", event.target.value)
            }
            error={Boolean(errors.outputs)}
            helperText={index === 0 ? errors.outputs : ""}
            required
          >
            {outputProducts
              .filter(
                (product) =>
                  product.skuId === output.skuId ||
                  !selectedOutputs.includes(product.skuId),
              )
              .map((product) => (
                <MenuItem key={product.skuId} value={product.skuId}>
                  {product.productName} ({product.productCode})
                </MenuItem>
              ))}
          </TextField>
          <TextField
            label={t("transformationRecipe.allocationWeight")}
            type="number"
            value={output.allocationWeight}
            onChange={(event) =>
              updateOutput(index, "allocationWeight", event.target.value)
            }
            inputProps={{ min: 0.001, max: 1, step: 0.001 }}
            required
          />
          <TextField
            label={t("transformationRecipe.yieldFactor")}
            type="number"
            value={output.yieldConversionFactor}
            onChange={(event) =>
              updateOutput(index, "yieldConversionFactor", event.target.value)
            }
            inputProps={{ min: 0.001, step: 0.001 }}
            required
          />
          <Tooltip title={t("transformationRecipe.removeOutput")}>
            <span>
              <IconButton
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    outputs: current.outputs.filter(
                      (_, rowIndex) => rowIndex !== index,
                    ),
                  }))
                }
                disabled={form.outputs.length === 1}
              >
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ))}
      <Button
        startIcon={<AddIcon />}
        onClick={() =>
          setForm((current) => ({
            ...current,
            outputs: [...current.outputs, emptyOutput()],
          }))
        }
        disabled={
          selectedOutputs.length < form.outputs.length ||
          selectedOutputs.length >= outputProducts.length
        }
      >
        {t("transformationRecipe.addOutput")}
      </Button>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)",
          },
          gap: 2,
          maxWidth: 880,
          mt: 3,
        }}
      >
        {[
          "expectedYieldMin",
          "expectedYieldMax",
          "expectedWasteMin",
          "expectedWasteMax",
        ].map((field) => (
          <TextField
            key={field}
            label={t(`transformationRecipe.${field}`)}
            name={field}
            type="number"
            value={form[field]}
            onChange={handleFieldChange}
            inputProps={{ min: 0, max: 1, step: 0.001 }}
            error={Boolean(errors[field])}
            helperText={errors[field]}
            required
          />
        ))}
      </Box>
      <Button
        type="submit"
        variant="contained"
        disabled={saving || !inputUom}
        sx={{ mt: 3 }}
      >
        {t("transformationRecipe.create")}
      </Button>
    </Box>
  );
};

export default TransformationRecipeForm;
