import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";

const notebook = { id: 1, nome: "Notebook", preco: 2500, quantidade: 5, valor_total_estoque: 12500 };
const mouse = { id: 2, nome: "Mouse", preco: 50, quantidade: 10, valor_total_estoque: 500 };

function respostaJson(dados, ok = true) { return { ok, json: async () => dados }; }
function lista(...produtos) {
  return { produtos, valor_total_estoque: produtos.reduce((total, p) => total + p.valor_total_estoque, 0) };
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Faturamento & Estoque - interface", () => {
  it("carrega produtos e atualiza os indicadores do painel", async () => {
    fetch.mockResolvedValueOnce(respostaJson(lista(notebook, mouse)));
    render(<App />);
    expect(await screen.findByText("Notebook")).toBeInTheDocument();
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("15", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("R$ 13.000,00")).toBeInTheDocument();
  });

  it("apresenta uma mensagem quando não consegue carregar a API", async () => {
    fetch.mockRejectedValueOnce(new Error("Falha de conexão"));
    render(<App />);
    expect(await screen.findByRole("status")).toHaveTextContent("Falha de conexão");
    expect(screen.getByText("Nenhum produto cadastrado.")).toBeInTheDocument();
  });

  it("cadastra produto, limpa o formulário e atualiza o catálogo", async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce(respostaJson(lista()))
      .mockResolvedValueOnce(respostaJson({ id: 3, nome: "Teclado", preco: 120, quantidade: 2 }))
      .mockResolvedValueOnce(respostaJson(lista({ id: 3, nome: "Teclado", preco: 120, quantidade: 2, valor_total_estoque: 240 })));
    render(<App />);
    await user.type(screen.getByLabelText("Nome do produto"), "Teclado");
    await user.type(screen.getByLabelText("Preço unitário (R$)"), "120");
    await user.clear(screen.getByLabelText("Quantidade inicial"));
    await user.type(screen.getByLabelText("Quantidade inicial"), "2");
    await user.click(screen.getByRole("button", { name: "Cadastrar produto" }));
    expect(await screen.findByText("Teclado")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Produto cadastrado com sucesso!");
    const requisicao = fetch.mock.calls.find(([, config]) => config?.method === "POST");
    expect(requisicao[0]).toBe("/api/produtos");
    expect(JSON.parse(requisicao[1].body)).toEqual({ nome: "Teclado", preco: 120, quantidade: 2 });
    expect(screen.getByLabelText("Nome do produto")).toHaveValue("");
  });

  it("filtra o catálogo pelo nome do produto", async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValueOnce(respostaJson(lista(notebook, mouse)));
    render(<App />);
    await screen.findByText("Notebook");
    await user.type(screen.getByRole("textbox", { name: "Buscar produto" }), "mou");
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(screen.queryByText("Notebook")).not.toBeInTheDocument();
  });

  it("registra entrada de estoque após confirmar a quantidade", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("2");
    fetch.mockResolvedValueOnce(respostaJson(lista(notebook)))
      .mockResolvedValueOnce(respostaJson({ ...notebook, quantidade: 7, valor_total_estoque: 17500 }))
      .mockResolvedValueOnce(respostaJson(lista({ ...notebook, quantidade: 7, valor_total_estoque: 17500 })));
    render(<App />);
    await screen.findByText("Notebook");
    await user.click(screen.getByTitle("Adicionar estoque"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/produtos/1/estoque/adicionar", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText("7 un.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Entrada de estoque registrada.");
  });

  it("cancela a exclusão quando o usuário não confirma", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    fetch.mockResolvedValueOnce(respostaJson(lista(notebook)));
    render(<App />);
    await screen.findByText("Notebook");
    await user.click(screen.getByTitle("Excluir produto"));
    expect(window.confirm).toHaveBeenCalledWith("Excluir o produto Notebook?");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Notebook")).toBeInTheDocument();
  });

  it("exclui produto após confirmação e atualiza o catálogo", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetch.mockResolvedValueOnce(respostaJson(lista(notebook)))
      .mockResolvedValueOnce(respostaJson({ mensagem: "Produto excluído com sucesso." }))
      .mockResolvedValueOnce(respostaJson(lista()));
    render(<App />);
    await screen.findByText("Notebook");
    await user.click(screen.getByTitle("Excluir produto"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/produtos/1", expect.objectContaining({ method: "DELETE" })));
    expect(await screen.findByText("Nenhum produto cadastrado.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Produto excluído.");
  });
});
