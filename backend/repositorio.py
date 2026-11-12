import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


CENTAVO = Decimal("0.01")


class RepositorioProdutos:
    def __init__(self):
        self.arquivo = Path(__file__).parent / "data" / "produtos.json"
        self.arquivo.parent.mkdir(parents=True, exist_ok=True)
        if not self.arquivo.exists():
            self._salvar([])
        self.produtos = self._carregar()

    @staticmethod
    def _formatar_preco(preco):
        valor = Decimal(str(preco)).quantize(
            CENTAVO,
            rounding=ROUND_HALF_UP,
        )
        return format(valor, ".2f")

    def _carregar(self):
        dados = json.loads(
            self.arquivo.read_text(encoding="utf-8"),
            parse_float=Decimal,
        )
        # Migra preços numéricos antigos para texto decimal com duas casas.
        for item in dados:
            item["preco"] = self._formatar_preco(item["preco"])
        return dados

    def _salvar(self, dados):
        self.arquivo.write_text(
            json.dumps(dados, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def listar(self):
        return list(self.produtos)

    def buscar(self, produto_id):
        return next((p for p in self.produtos if p["id"] == produto_id), None)

    def criar(self, nome, preco, quantidade):
        novo_id = max((p["id"] for p in self.produtos), default=0) + 1
        item = {
            "id": novo_id,
            "nome": nome,
            "preco": self._formatar_preco(preco),
            "quantidade": int(quantidade),
        }
        self.produtos.append(item)
        self._salvar(self.produtos)
        return item

    def atualizar(self, produto_id, **campos):
        item = self.buscar(produto_id)
        if item is None:
            return None
        if "preco" in campos:
            campos["preco"] = self._formatar_preco(campos["preco"])
        item.update(campos)
        self._salvar(self.produtos)
        return item

    def excluir(self, produto_id):
        item = self.buscar(produto_id)
        if item is None:
            return False
        self.produtos.remove(item)
        self._salvar(self.produtos)
        return True
