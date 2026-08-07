import logoDeliHub from '../assets/logo-delihub.png';

/**
 * Marca oficial do DeliHub (arquivo em src/assets/logo-delihub.png já traz
 * ícone + wordmark prontos). `altura` controla o tamanho — a largura segue
 * a proporção original da imagem (~4.24:1).
 */
export default function LogoDeliHub({ altura = 28, className = '' }) {
  return (
    <img
      src={logoDeliHub}
      alt="DeliHub"
      style={{ height: altura }}
      className={`w-auto ${className}`}
    />
  );
}
