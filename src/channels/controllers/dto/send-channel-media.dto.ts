import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsAtLeastOneProvided(property: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAtLeastOneProvided',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          // Returns true if either the current field or the related field has a value
          return !!value || !!relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          return `At least one of ${args.property} or ${args.constraints[0]} must be provided.`;
        },
      },
    });
  };
}

export class SendChannelMediaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsAtLeastOneProvided('email') // Validates against email
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsAtLeastOneProvided('email') // Validates against email
  phone: string;


  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;


  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ enum: ['document', 'image', 'video', 'audio'] })
  @IsString()
  @IsIn(['document', 'image', 'video', 'audio'])
  documentType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;
}

export class SendChannelMediaFormDto extends SendChannelMediaDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  file?: any;
}
