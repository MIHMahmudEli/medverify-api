import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const uploadDir = join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  @ApiOperation({ summary: 'Upload medical image (X-Ray, Fingerprint, Patient Photo)' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const randomName = uuidv4();
          cb(null, `${randomName}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMime.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPG, PNG, and WebP medical images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file rejected');
    }
    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `/api/v1/uploads/file/${file.filename}`,
    };
  }

  @ApiOperation({ summary: 'Serve uploaded medical image' })
  @Get('file/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // Sanitize filename to prevent directory traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '');

    const candidatePaths = [
      join(uploadDir, safeFilename),
      join(process.cwd(), 'assets', safeFilename),
      join(process.cwd(), 'medverify-api', 'assets', safeFilename),
      join(process.cwd(), 'dist', 'assets', safeFilename),
      join(__dirname, 'assets', safeFilename),
      join(__dirname, '../assets', safeFilename),
      join(__dirname, '../../assets', safeFilename),
      join(__dirname, '../../../assets', safeFilename),
      join(__dirname, '../../../../assets', safeFilename),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return res.sendFile(p);
      }
    }

    throw new NotFoundException('File not found');
  }
}
