export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

export function getVerificationStatusText(status: VerificationStatus | string | undefined | null): string {
  switch (status) {
    case VerificationStatus.VERIFIED:
      return 'Đã xác minh';
    case VerificationStatus.REJECTED:
      return 'Từ chối';
    case VerificationStatus.PENDING:
      return 'Đang chờ duyệt';
    default:
      return 'Không xác định';
  }
}

export function getVerificationStatusCssClass(status: VerificationStatus | string | undefined | null): string {
  switch (status) {
    case VerificationStatus.VERIFIED:
      return 'text-green-600 bg-green-100 border border-green-200';
    case VerificationStatus.REJECTED:
      return 'text-red-600 bg-red-100 border border-red-200';
    case VerificationStatus.PENDING:
      return 'text-yellow-600 bg-yellow-100 border border-yellow-200';
    default:
      return 'text-gray-600 bg-gray-100 border border-gray-200';
  }
}

