document.addEventListener("DOMContentLoaded", () => {
  const ingredientData = [
    { value: "farinha-trigo", label: "Farinha de trigo", category: "peso", unit: "g" },
    { value: "ovos", label: "Ovos", category: "unidade", unit: "un" },
    { value: "acucar", label: "Açúcar", category: "peso", unit: "g" },
    { value: "manteiga", label: "Manteiga", category: "peso", unit: "g" },
    { value: "oleo", label: "Óleo", category: "volume", unit: "ml" },
    { value: "leite", label: "Leite", category: "volume", unit: "ml" },
    { value: "fermento", label: "Fermento", category: "peso", unit: "g" },
    { value: "sal", label: "Sal", category: "peso", unit: "g" },
    { value: "essencia", label: "Essência", category: "volume", unit: "ml" }
  ];

  const measurementOptions = {
    peso: [
      { value: "g", label: "Grama (g)", factor: 1 },
      { value: "kg", label: "Quilograma (kg) · 1 kg = 1.000 g", factor: 1000 },
      { value: "mg", label: "Miligrama (mg) · 1.000 mg = 1 g", factor: 0.001 }
    ],
    volume: [
      { value: "ml", label: "Mililitro (ml)", factor: 1 },
      { value: "l", label: "Litro (L) · 1 L = 1.000 ml", factor: 1000 },
      { value: "xicara", label: "Xícara de chá · 1 xícara = 240 ml", factor: 240 },
      { value: "copo", label: "Copo americano · 1 copo = 200 ml", factor: 200 },
      { value: "colher-sopa", label: "Colher de sopa (c. sopa) · 1 = 15 ml", factor: 15 },
      { value: "colher-cha", label: "Colher de chá (c. chá) · 1 = 5 ml", factor: 5 },
      { value: "colher-cafe", label: "Colher de café (c. café) · 1 = 2,5 ml", factor: 2.5 }
    ],
    unidade: [{ value: "un", label: "Unidade", factor: 1 }]
  };


  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  const STORAGE_KEY = "forno-afeto-receitas";
  const MAX_RECIPES = 10;

  const addRowBtn = document.getElementById("add-row-btn");
  const ingredientBody = document.getElementById("ingredient-body");
  const rowTemplate = document.getElementById("ingredient-row-template");
  const totalCostCell = document.getElementById("total-cost");
  const recipeNameInput = document.getElementById("recipe-name");
  const saveRecipeBtn = document.getElementById("save-recipe");
  const newRecipeBtn = document.getElementById("new-recipe");
  const exportRecipeBtn = document.getElementById("export-recipe");
  const exportPdfBtn = document.getElementById("export-pdf");
  const recipeStatus = document.getElementById("recipe-status");
  const historyList = document.getElementById("recipe-history");

  let recipeCache = [];
  let currentRecipeId = null;

  const findIngredient = (value) => ingredientData.find((item) => item.value === value);

  const loadRecipesFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Não foi possível carregar as receitas salvas.", error);
      return [];
    }
  };

  const persistRecipes = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipeCache));
  };

  const showStatus = (message, type = "info") => {
    recipeStatus.textContent = message;
    recipeStatus.classList.remove("success");
    recipeStatus.classList.remove("error");
    if (type === "success") {
      recipeStatus.classList.add("success");
    }
    if (type === "error") {
      recipeStatus.classList.add("error");
    }
  };

  const populateHistory = () => {
    historyList.innerHTML = "";

    if (!recipeCache.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "history-empty";
      emptyItem.textContent = "Nenhuma receita salva ainda.";
      historyList.appendChild(emptyItem);
      return;
    }

    recipeCache.forEach((recipe) => {
      const item = document.createElement("li");
      item.className = "history-item";

      const info = document.createElement("div");
      info.className = "history-info";

      const name = document.createElement("strong");
      name.textContent = recipe.name;

      const total = document.createElement("span");
      total.textContent = recipe.total || currencyFormatter.format(0);

      info.appendChild(name);
      info.appendChild(total);

      const actions = document.createElement("div");
      actions.className = "history-actions";

      const loadButton = document.createElement("button");
      loadButton.type = "button";
      loadButton.className = "ghost";
      loadButton.textContent = "Carregar";
      loadButton.addEventListener("click", () => loadRecipe(recipe.id));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "ghost danger";
      deleteButton.textContent = "Excluir";
      deleteButton.addEventListener("click", () => deleteRecipe(recipe.id));

      actions.appendChild(loadButton);
      actions.appendChild(deleteButton);

      item.appendChild(info);
      item.appendChild(actions);

      historyList.appendChild(item);
    });
  };

  function populateIngredientSelect(select) {
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione…";
    select.appendChild(placeholder);

    ingredientData.forEach((ingredient) => {
      const option = document.createElement("option");
      option.value = ingredient.value;
      option.textContent = ingredient.label;
      option.dataset.category = ingredient.category;
      option.dataset.unit = ingredient.unit;
      select.appendChild(option);
    });

    const other = document.createElement("option");
    other.value = "outro";
    other.textContent = "Outro (digite)";
    other.dataset.category = "peso";
    select.appendChild(other);
  }

  function populateUnits(select, category) {
    select.innerHTML = "";
    measurementOptions[category].forEach((unitOption) => {
      const option = document.createElement("option");
      option.value = unitOption.value;
      option.textContent = unitOption.label;
      select.appendChild(option);
    });
  }

  function convertToBase(value, unit, category) {
    if (!value) return 0;
    const options = measurementOptions[category];
    const match = options.find((item) => item.value === unit);
    return match ? value * match.factor : value;
  }

  function updateCost(row) {
    const category = row.querySelector(".category-select").value;
    const unitSelect = row.querySelector(".unit-select");
    const purchaseUnitSelect = row.querySelector(".purchase-unit-select");
    const amountUsed = parseFloat(row.querySelector(".amount-used").value.replace(",", "."));
    const amountPurchased = parseFloat(row.querySelector(".amount-purchased").value.replace(",", "."));
    const pricePaid = parseFloat(row.querySelector(".price-paid").value.replace(",", "."));
    const costCell = row.querySelector(".cost-cell");

    const usedBase = convertToBase(amountUsed, unitSelect.value, category);
    const purchasedBase = convertToBase(amountPurchased, purchaseUnitSelect.value, category);

    let cost = 0;
    if (usedBase > 0 && purchasedBase > 0 && pricePaid > 0) {
      cost = (usedBase / purchasedBase) * pricePaid;
    }

    costCell.textContent = currencyFormatter.format(cost || 0);
    updateTotal();
  }

  function updateTotal() {
    const costs = [...ingredientBody.querySelectorAll(".cost-cell")].map((cell) => {
      const numeric = cell.textContent.replace(/[^0-9,.-]+/g, "").replace(",", ".");
      return parseFloat(numeric) || 0;
    });

    const total = costs.reduce((acc, value) => acc + value, 0);
    totalCostCell.textContent = currencyFormatter.format(total);
  }

  function handleIngredientChange(row, select) {
    const selectedValue = select.value;
    const customInput = row.querySelector(".custom-ingredient");
    const categorySelect = row.querySelector(".category-select");

    if (selectedValue === "outro") {
      customInput.style.display = "block";
      customInput.focus();
    } else {
      customInput.value = "";
      customInput.style.display = "none";
    }

    const ingredient = findIngredient(selectedValue);
    if (ingredient) {
      categorySelect.value = ingredient.category;
      populateUnits(row.querySelector(".unit-select"), ingredient.category);
      row.querySelector(".unit-select").value = ingredient.unit;
      populateUnits(row.querySelector(".purchase-unit-select"), ingredient.category);
      row.querySelector(".purchase-unit-select").value = ingredient.unit;
    }

    updateCost(row);
  }

  function handleCategoryChange(row, category) {
    populateUnits(row.querySelector(".unit-select"), category);
    populateUnits(row.querySelector(".purchase-unit-select"), category);
    updateCost(row);
  }

  function attachRowEvents(row) {
    const ingredientSelect = row.querySelector(".ingredient-select");
    const categorySelect = row.querySelector(".category-select");
    const inputs = row.querySelectorAll("input, select");
    const removeBtn = row.querySelector(".remove-row");

    ingredientSelect.addEventListener("change", () => handleIngredientChange(row, ingredientSelect));
    categorySelect.addEventListener("change", () => handleCategoryChange(row, categorySelect.value));

    inputs.forEach((input) => {
      if (input.classList.contains("ingredient-select") || input.classList.contains("category-select")) {
        return;
      }
      input.addEventListener("input", () => updateCost(row));
      input.addEventListener("change", () => updateCost(row));
    });

    removeBtn.addEventListener("click", () => {
      row.remove();
      updateTotal();
    });
  }

  function addRow(rowData = null) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const ingredientSelect = row.querySelector(".ingredient-select");
    const categorySelect = row.querySelector(".category-select");
    const unitSelect = row.querySelector(".unit-select");
    const purchaseUnitSelect = row.querySelector(".purchase-unit-select");

    populateIngredientSelect(ingredientSelect);

    const defaultCategory = categorySelect.value;
    populateUnits(unitSelect, defaultCategory);
    populateUnits(purchaseUnitSelect, defaultCategory);

    attachRowEvents(row);
    ingredientBody.appendChild(row);

    if (rowData) {
      const { ingredientValue, customName, category, unit, amountUsed, amountPurchased, purchaseUnit, pricePaid } = rowData;

      if (ingredientValue && ingredientSelect.querySelector(`option[value="${ingredientValue}"]`)) {
        ingredientSelect.value = ingredientValue;
      } else if (ingredientValue) {
        ingredientSelect.value = "outro";
      }
      ingredientSelect.dispatchEvent(new Event("change"));

      if (ingredientSelect.value === "outro") {
        const customInput = row.querySelector(".custom-ingredient");
        customInput.style.display = "block";
        customInput.value = customName || "";
      }

      categorySelect.value = category || categorySelect.value;
      categorySelect.dispatchEvent(new Event("change"));

      if (unit) {
        unitSelect.value = unit;
      }

      row.querySelector(".amount-used").value = amountUsed || "";

      if (purchaseUnit) {
        purchaseUnitSelect.value = purchaseUnit;
      }

      row.querySelector(".amount-purchased").value = amountPurchased || "";
      row.querySelector(".price-paid").value = pricePaid || "";
      updateCost(row);
    } else {
      updateCost(row);
    }
  }

  const collectRowsData = () =>
    [...ingredientBody.querySelectorAll("tr")].map((row) => ({
      ingredientValue: row.querySelector(".ingredient-select").value,
      customName: row.querySelector(".custom-ingredient").value,
      category: row.querySelector(".category-select").value,
      unit: row.querySelector(".unit-select").value,
      amountUsed: row.querySelector(".amount-used").value,
      amountPurchased: row.querySelector(".amount-purchased").value,
      purchaseUnit: row.querySelector(".purchase-unit-select").value,
      pricePaid: row.querySelector(".price-paid").value,
      cost: row.querySelector(".cost-cell").textContent
    }));

  const sanitizeFileName = (name) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "receita-forno-afeto";

  const rowsToCSV = (rows, recipeName, total) => {
    const header = [
      "Ingrediente",
      "Categoria",
      "Unidade usada",
      "Qtd utilizada",
      "Qtd comprada",
      "Unidade de compra",
      "Preço pago (R$)",
      "Custo na receita (R$)"
    ];

    const lines = rows.map((row) => {
      const ingredient = row.ingredientValue === "outro" || !row.ingredientValue ? row.customName || "" : (findIngredient(row.ingredientValue)?.label ?? "");
      return [
        ingredient,
        row.category,
        row.unit,
        row.amountUsed,
        row.amountPurchased,
        row.purchaseUnit,
        row.pricePaid,
        row.cost
      ]
        .map((value) => {
          const strValue = value == null ? "" : String(value);
          const safeValue = strValue.replace(/"/g, '""');
          return `"${safeValue}"`;
        })
        .join(";");
    });

    return ["sep=;", `"Receita";"${recipeName.replace(/"/g, '""')}"`, header.map((label) => `"${label}"`).join(";"), ...lines, `"Total";"";"";"";"";"";"";"${total}"`].join("\n");
  };

  const escapeHtml = (value) =>
    (value ?? "")
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const rowsToPdfHtml = (rows, recipeName, total) => {
    const currentDate = new Date().toLocaleDateString("pt-BR");
    const tableRows = rows
      .map((row) => {
        const ingredient =
          row.ingredientValue === "outro" || !row.ingredientValue
            ? row.customName || ""
            : findIngredient(row.ingredientValue)?.label ?? "";

        return `
          <tr>
            <td>${escapeHtml(ingredient)}</td>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.unit)}</td>
            <td>${escapeHtml(row.amountUsed)}</td>
            <td>${escapeHtml(row.amountPurchased)}</td>
            <td>${escapeHtml(row.purchaseUnit)}</td>
            <td>${escapeHtml(row.pricePaid)}</td>
            <td>${escapeHtml(row.cost)}</td>
          </tr>`;
      })
      .join("");

    return `<!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Receita · ${escapeHtml(recipeName)}</title>
          <style>
            :root {
              color-scheme: light;
              font-family: 'Montserrat', Arial, sans-serif;
            }
            body {
              margin: 0;
              padding: 32px;
              background: #fff8f0;
              color: #3a2d2b;
            }
            header {
              margin-bottom: 24px;
              text-align: center;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 1.8rem;
              color: #6e3720;
              font-family: 'Josefin Sans', 'Montserrat', sans-serif;
            }
            .meta {
              color: #8c7c75;
              font-size: 0.9rem;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
            }
            thead {
              background: #f0c8a4;
              color: #6e3720;
            }
            th, td {
              padding: 8px 10px;
              border: 1px solid rgba(0,0,0,0.1);
              font-size: 0.95rem;
            }
            tfoot td {
              font-weight: 600;
              background: rgba(255, 195, 153, 0.35);
            }
            .footer-note {
              margin-top: 24px;
              font-size: 0.85rem;
              color: #8c7c75;
              text-align: center;
            }
            @media print {
              body {
                background: white;
                padding: 24px;
              }
              .footer-note {
                margin-top: 40px;
              }
            }
          </style>
        </head>
        <body>
          <header>
            <h1>Receita · ${escapeHtml(recipeName)}</h1>
            <p class="meta">Gerado em ${escapeHtml(currentDate)} · Forno &amp; Afeto</p>
          </header>
          <section>
            <table>
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Categoria</th>
                  <th>Unidade usada</th>
                  <th>Qtd utilizada</th>
                  <th>Qtd comprada</th>
                  <th>Unidade de compra</th>
                  <th>Preço pago (R$)</th>
                  <th>Custo na receita (R$)</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
              <tfoot>
                <tr>
                  <td colspan="7">Total</td>
                  <td>${escapeHtml(total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
          <p class="footer-note">Documento gerado automaticamente pela calculadora de custos Forno &amp; Afeto.</p>
          <script>
            window.addEventListener('load', () => {
              window.print();
            });
          <\/script>
        </body>
      </html>`;
  };

  const resetForm = () => {
    ingredientBody.innerHTML = "";
    addRow();
    recipeNameInput.value = "";
    currentRecipeId = null;
    updateTotal();
  };

  const saveCurrentRecipe = () => {
    const name = recipeNameInput.value.trim();
    if (!name) {
      showStatus("Informe um nome para salvar a receita.", "error");
      recipeNameInput.focus();
      return;
    }

    const rowsData = collectRowsData();
    const total = totalCostCell.textContent;
    const timestamp = new Date().toISOString();

    const recipePayload = {
      id: currentRecipeId || crypto.randomUUID(),
      name,
      rows: rowsData,
      total,
      updatedAt: timestamp
    };

    const existingIndex = recipeCache.findIndex((recipe) => recipe.id === recipePayload.id);

    if (existingIndex >= 0) {
      recipeCache.splice(existingIndex, 1);
    }

    recipeCache.unshift(recipePayload);

    if (recipeCache.length > MAX_RECIPES) {
      recipeCache = recipeCache.slice(0, MAX_RECIPES);
    }

    currentRecipeId = recipePayload.id;
    persistRecipes();
    populateHistory();
    showStatus("Receita salva com sucesso!", "success");
  };

  const loadRecipe = (recipeId) => {
    const recipe = recipeCache.find((item) => item.id === recipeId);
    if (!recipe) {
      showStatus("Não foi possível carregar a receita selecionada.");
      return;
    }

    ingredientBody.innerHTML = "";
    recipe.rows.forEach((rowData) => addRow(rowData));
    recipeNameInput.value = recipe.name;
    currentRecipeId = recipe.id;
    updateTotal();
    showStatus(`Receita "${recipe.name}" carregada.`, "success");
  };

  const deleteRecipe = (recipeId) => {
    recipeCache = recipeCache.filter((recipe) => recipe.id !== recipeId);
    if (currentRecipeId === recipeId) {
      resetForm();
      showStatus("A receita ativa foi removida. Formulário limpo.");
    }
    persistRecipes();
    populateHistory();
  };

  const exportCurrentRecipe = () => {
    const name = recipeNameInput.value.trim();
    if (!name) {
      showStatus("Informe um nome antes de exportar.", "error");
      recipeNameInput.focus();
      return;
    }

    const rowsData = collectRowsData();
    const hasContent = rowsData.some(
      (row) => row.ingredientValue || row.customName || row.amountUsed || row.amountPurchased || row.pricePaid
    );

    if (!hasContent) {
      showStatus("Adicione ao menos um ingrediente antes de exportar.", "error");
      return;
    }

    const csvContent = rowsToCSV(rowsData, name, totalCostCell.textContent);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(name)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showStatus("Arquivo CSV gerado com sucesso!", "success");
  };

  const exportCurrentRecipePdf = () => {
    const name = recipeNameInput.value.trim();
    if (!name) {
      showStatus("Informe um nome antes de exportar.", "error");
      recipeNameInput.focus();
      return;
    }

    const rowsData = collectRowsData();
    const hasContent = rowsData.some(
      (row) => row.ingredientValue || row.customName || row.amountUsed || row.amountPurchased || row.pricePaid
    );

    if (!hasContent) {
      showStatus("Adicione ao menos um ingrediente antes de exportar.", "error");
      return;
    }

    const pdfWindow = window.open("", "_blank", "noopener=yes,width=900,height=650");
    if (!pdfWindow) {
      showStatus("Não foi possível abrir a janela para exportação. Verifique o bloqueador de pop-ups.", "error");
      return;
    }

    pdfWindow.document.open();
    pdfWindow.document.write(rowsToPdfHtml(rowsData, name, totalCostCell.textContent));
    pdfWindow.document.close();

    showStatus("Pré-visualização em PDF aberta em nova janela.", "success");
  };

  window.loadRecipe = loadRecipe;
  window.deleteRecipe = deleteRecipe;

  addRowBtn.addEventListener("click", addRow);
  saveRecipeBtn.addEventListener("click", saveCurrentRecipe);
  newRecipeBtn.addEventListener("click", () => {
    resetForm();
    showStatus("Inicie uma nova receita preenchendo os campos.");
  });
  exportRecipeBtn.addEventListener("click", exportCurrentRecipe);
  exportPdfBtn.addEventListener("click", exportCurrentRecipePdf);

  recipeCache = loadRecipesFromStorage();
  populateHistory();
  addRow();
});
