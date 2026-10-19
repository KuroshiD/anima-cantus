import { expect, test } from "@playwright/test";

test("a página inicial abre o acesso e permite alternar para cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByRole("heading", { name: "Bem-vindos de volta" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Criem sua conta" })).toBeVisible();
  await expect(page.getByLabel("Telefone com DDD")).toBeVisible();
  await expect(page.getByLabel("Data do casamento")).toBeVisible();
  await page.getByRole("button", { name: "Criar conta" }).last().click();
  await expect(page.getByText("Informe o nome da primeira pessoa.")).toBeVisible();
  await expect(page.getByText("Informe um telefone com DDD.")).toBeVisible();
  await expect(page.getByText("Aceite os termos para continuar.")).toBeVisible();
});
