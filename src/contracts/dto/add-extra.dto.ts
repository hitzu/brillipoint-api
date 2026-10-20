import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddExtraDto {
  @IsNumber()
  extraId!: number;

  @IsNumber()
  quantity!: number;

  /**
   * Must match one of the `clientRef` values in the request's `packages`
   * array. Used to resolve which ContractPackage row this extra belongs to,
   * so the server can compute the tiered promotion discount. There is no
   * client-supplied discount/promotion input — it is always computed server-side.
   */
  @IsString()
  @IsOptional()
  packageClientRef?: string;

  /**
   * Staff courtesy: the extra is delivered at no cost. Its catalog price is
   * still snapshotted so the gifted value stays reportable, and it does not
   * consume a promotion tier.
   */
  @IsBoolean()
  @IsOptional()
  isGift?: boolean;
}
