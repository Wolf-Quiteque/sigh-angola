import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Página não encontrada</h1>
      <p>Este endereço não corresponde a nenhum ecrã do sistema.</p>
      <Link href="/" className="button primary">
        Voltar à visão geral
      </Link>
    </div>
  );
}
