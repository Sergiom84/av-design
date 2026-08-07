-- Generado por scripts/generar-seed.mjs. No editar a mano.
-- Fuente: data/catalogo-equipos.csv, data/catalogo-cable.csv, data/plantillas-salas.csv, data/puertos.csv
begin;

-- Parámetros de cálculo de cable (criterio del departamento AV)
insert into parametros (clave, valor, unidad, descripcion) values
  ('holgura_pantalla', 0.35, 'm', 'Holgura en el extremo que acaba en pantalla (rango 0,20–0,50)'),
  ('holgura_proyector', 0.1, 'm', 'Holgura en el extremo que acaba en proyector'),
  ('holgura_rack', 1, 'm', 'Holgura en el extremo que acaba en rack'),
  ('holgura_caja_conexiones', 0.5, 'm', 'Holgura en caja de conexiones de mesa'),
  ('holgura_mesa', 0.5, 'm', 'Holgura en toma de mesa'),
  ('holgura_techo', 0.3, 'm', 'Holgura en altavoz o micrófono de techo'),
  ('holgura_pared', 0.3, 'm', 'Holgura en toma o placa de pared'),
  ('margen', 0, 'tanto por uno', 'Margen de seguridad sobre el total. 0 = ninguno'),
  ('cables_por_canalizacion', 3, 'ud', 'El previsto más un RJ45 y un HDMI de reserva'),
  ('ocupacion_maxima_canaleta', 0.4, 'tanto por uno', 'Ocupación máxima admitida en canaleta'),
  ('vigencia_precio_meses', 18, 'meses', 'Antigüedad máxima de un presupuesto para que su precio cuente como coste'),
  ('tipo_cambio_usd_eur', 0.867, 'EUR por USD', 'Para convertir precios de referencia en dólares. Agosto de 2026')
on conflict (clave) do update set valor = excluded.valor, descripcion = excluded.descripcion;

-- Catálogo: 809 equipos del inventario real
insert into articulos (tipo, categoria, marca, modelo, unidad, unidades_instaladas) values
  ('equipo', 'PANEL TÁCTIL', 'CISCO', 'ROOM NAVIGATOR', 'ud', 406),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'SPARK ROOM KIT', 'ud', 285),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB65R-B', 'ud', 266),
  ('equipo', 'MICRÓFONO', 'CISCO', 'TABLE MICROPHONE MINI JACK (V1)', 'ud', 227),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB65R', 'ud', 207),
  ('equipo', 'PC', 'LENOVO', 'M920Q', 'ud', 108),
  ('equipo', 'CAJA DE CONEXIONES', 'BACHMANN', 'TOPFRAME', 'ud', 102),
  ('equipo', 'MONITOR', 'SAMSUNG', 'QB65H', 'ud', 77),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB55R', 'ud', 73),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'WEBEX ROOM BAR PRO', 'ud', 71),
  ('equipo', 'BARRA DE VIDEOCONFERENCIA', 'AVER', 'VB342', 'ud', 85),
  ('equipo', 'ALTAVOZ', 'GENELEC', '4010AW', 'ud', 74),
  ('equipo', 'MICRÓFONO', 'CISCO', 'TABLE MICROPHONE MINI JACK (V2)', 'ud', 60),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB55R-B', 'ud', 60),
  ('equipo', 'TRANSMISOR DE VÍDEO', 'CRESTRON', 'DM-NVX-E30', 'ud', 87),
  ('equipo', 'MONITOR', 'SAMSUNG', 'OM75D-W', 'ud', 58),
  ('equipo', 'PANEL TÁCTIL', 'CISCO', 'TOUCH 10', 'ud', 100),
  ('equipo', 'RECEPTOR VÍDEO', 'EXTRON', 'DTP HDMI 4K 230 RX', 'ud', 61),
  ('equipo', 'MICRÓFONO', 'BOSCH', 'CONCENTRUS', 'ud', 48),
  ('equipo', 'CÁMARA', 'CRESTRON', 'UC-SB1-CAM', 'ud', 90),
  ('equipo', 'PANTALLA ROOMWIZARD', 'STEELCASE', 'ROOMWIZARD II', 'ud', 46),
  ('equipo', 'TRANSMISOR VÍDEO', 'EXTRON', 'DTP HDMI 4K 230 TX', 'ud', 45),
  ('equipo', 'MICRÓFONO', 'BOSCH', 'DCN-DISDCS-L', 'ud', 40),
  ('equipo', 'MICRÓFONO', 'DICENTIS', 'DCNM-WD', 'ud', 39),
  ('equipo', 'RECEPTOR DE VÍDEO', 'CRESTRON', 'DM-NVX-D30', 'ud', 67),
  ('equipo', 'PC', 'LENOVO', 'THINKCENTRE M920Q', 'ud', 36),
  ('equipo', 'ALTAVOZ', 'BOSE', 'FREESPACE DS100F', 'ud', 32),
  ('equipo', 'CÁMARA', 'CISCO', 'QUAD CAMERA', 'ud', 32),
  ('equipo', 'SOPORTE DE ALTAVOZ', 'GENELEC', '8000-422B/W', 'ud', 30),
  ('equipo', 'SOPORTE DE PANTALLA', 'VOGELS', 'T1844', 'ud', 30),
  ('equipo', 'TECLADO/RATÓN', 'LOGITECH', 'MK710', 'ud', 32),
  ('equipo', 'MICRÓFONO', 'BOSCH', 'DCN-DVCS', 'ud', 25),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB65C', 'ud', 30),
  ('equipo', 'PC', 'LENOVO', 'M910Q', 'ud', 25),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'ROOM BAR PRO', 'ud', 27),
  ('equipo', 'TECLADO', 'LOGITECH', 'K400+', 'ud', 36),
  ('equipo', 'DOCK STATION', 'TARGUS', 'DOCK182', 'ud', 22),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB75R', 'ud', 21),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'DM65D', 'ud', 20),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB65N', 'ud', 21),
  ('equipo', 'PROYECTOR', 'SONY', 'VPL-PHZ10', 'ud', 21),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX2/SM58', 'ud', 19),
  ('equipo', 'MICRÓFONO MESA', 'BOSCH', 'DCN-CONCS', 'ud', 19),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-1485FI', 'ud', 19),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX1', 'ud', 19),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'PM43H', 'ud', 18),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'WEBEX ROOM EQ', 'ud', 17),
  ('equipo', 'MICRÓFONO', 'BEYER ORBIS', 'MU21', 'ud', 16),
  ('equipo', 'MONITOR', 'ARTHUR HOLM', 'AH19DX216GA2M2P', 'ud', 16),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-L630U', 'ud', 16),
  ('equipo', 'ALTAVOZ', 'GENELEC', '4010AM', 'ud', 16),
  ('equipo', 'MICRÓFONO', 'BOSCH', 'LBB4144/00', 'ud', 30),
  ('equipo', 'TÓTEM CON PANTALLA', 'VOGELS', 'CONNECT-IT TROLLEY', 'ud', 17),
  ('equipo', 'BANDEJA CÁMARA', 'VOGELS', 'PVA 5050', 'ud', 14),
  ('equipo', 'CAJA DE CONEXIONES', 'AMX', 'HPX 1200', 'ud', 14),
  ('equipo', 'DOCK STATION', 'TARGUS', 'DOCK 192-A', 'ud', 14),
  ('equipo', 'DOCK STATION', 'TARGUS', 'DOCK180EUZ', 'ud', 14),
  ('equipo', 'TECLADO', 'LOGITECH', 'K400 PLUS TV', 'ud', 15),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'WEBEX ROOM EQ QUADCAM', 'ud', 14),
  ('equipo', 'CÁMARA', 'CISCO', 'P60', 'ud', 14),
  ('equipo', 'MICRÓFONO', 'YEALINK', 'VCM35', 'ud', 13),
  ('equipo', 'MONITOR', 'ALBIRAL', 'AH17TXHDGA', 'ud', 13),
  ('equipo', 'TRANSMISOR VÍDEO', 'CRESTRON', 'DM-NVX-E20', 'ud', 23),
  ('equipo', 'CONTROLADORA', 'EXTRON', 'IPCP PRO 250', 'ud', 14),
  ('equipo', 'ESCALADOR', 'EXTRON', 'IN1604 HD', 'ud', 19),
  ('equipo', 'MICROFONÍA', 'SHURE', 'BLX1288/W85 COMBO S8', 'ud', 18),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'ROOM KIT EQ', 'ud', 14),
  ('equipo', 'ALTAVOZ', 'GENELEC', '4010A', 'ud', 13),
  ('equipo', 'MICRÓFONO', 'CISCO', 'TABLE MICROPHONE 20', 'ud', 11),
  ('equipo', 'MONITOR', 'SONY', 'LMD-150S', 'ud', 11),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB43R', 'ud', 11),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB65B', 'ud', 11),
  ('equipo', 'ALTAVOZ DE TECHO', 'MONITOR AUDIO', 'PRO-65', 'ud', 18),
  ('equipo', 'BARRA DE VIDEOCONFERENCIA', 'CISCO', 'ROOM KIT', 'ud', 12),
  ('equipo', 'CONTROLADORA', 'CRESTRON', 'MC4', 'ud', 10),
  ('equipo', 'CÁMARA', 'AVER', 'CAM520PRO POE', 'ud', 17),
  ('equipo', 'MICRÓFONO', 'BIAMP', 'TESIRA PARLÉ TCM-XEX', 'ud', 16),
  ('equipo', 'MICRÓFONO', 'BOSCH', 'DCN-CON', 'ud', 10),
  ('equipo', 'CÁMARA', 'CISCO', 'PTZ 4K', 'ud', 17),
  ('equipo', 'EXTENSOR', 'CRESTRON', 'HD-RXU-4KZ-101-E DM', 'ud', 9),
  ('equipo', 'EXTENSOR', 'CRESTRON', 'HD-TXU-4KZ-211-CHGR', 'ud', 11),
  ('equipo', 'MONITOR TÁCTIL', 'NEWLINE', 'TT-2721AIO', 'ud', 9),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QM32R-B', 'ud', 9),
  ('equipo', 'PROYECTOR', 'LG', 'LGBU50NST', 'ud', 9),
  ('equipo', 'SWITCH', 'NETGEAR', 'GS305EP', 'ud', 9),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'ROOM KIT PRO', 'ud', 9),
  ('equipo', 'ALTAVOZ', 'BOSE', 'FREESPACE 3', 'ud', 8),
  ('equipo', 'BARRA DE VIDEOCONFERENCIA', 'YEALINK', 'A40', 'ud', 11),
  ('equipo', 'CONTROLADORA', 'CRESTRON', 'MC4 (PC)', 'ud', 8),
  ('equipo', 'CONTROLADORA', 'CRESTRON', 'RMC4', 'ud', 8),
  ('equipo', 'CONTROLADORA DE PROYECTOR', 'EPSON', 'ELPHD02', 'ud', 8),
  ('equipo', 'ESCALADOR', 'CRESTRON', 'HD-RX-4K-510-CE', 'ud', 8),
  ('equipo', 'EXTENSOR', 'YEALINK', 'VCH51', 'ud', 9),
  ('equipo', 'KIT BOTONES', 'EXTRON', 'CB-100-010525', 'ud', 8),
  ('equipo', 'MONITOR', 'LG', '75XS4G-BJ', 'ud', 8),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'TS-1070', 'ud', 8),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'DM55E', 'ud', 8),
  ('equipo', 'PANTALLA', 'SONY', 'FW - 65X8570C', 'ud', 8),
  ('equipo', 'RECEPTOR VÍDEO', 'CRESTRON', 'DM-NVX-D20', 'ud', 14),
  ('equipo', 'TELÉFONO IP', 'CISCO', 'CP-7945G', 'ud', 8),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'ROOM BAR BYOD', 'ud', 8),
  ('equipo', 'CÁMARA', 'SONY', 'SRG-X400', 'ud', 7),
  ('equipo', 'EXTENSOR', 'EXTRON', 'TX DTP3 T 202', 'ud', 7),
  ('equipo', 'MATRIZ', 'LIGHTWARE', 'UCX-4X2-HC30', 'ud', 7),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB55N', 'ud', 7),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB75N', 'ud', 8),
  ('equipo', 'PANTALLA', 'SONY', 'KDL-55W802A', 'ud', 7),
  ('equipo', 'PANTALLA', 'SONY', 'KDL-65W855A', 'ud', 8),
  ('equipo', 'PC', 'HP', 'PRODESK 600 G4', 'ud', 9),
  ('equipo', 'SOPORTE DE PROYECTOR', 'TRAULUX', 'SPT-82120', 'ud', 7),
  ('equipo', 'TECLADO', 'LOGITECH', 'K750', 'ud', 8),
  ('equipo', 'TÓTEM CON PANTALLA', 'VOGELS', 'FD 2064 S', 'ud', 16),
  ('equipo', 'VIDEOCONFERENCIA', 'YEALINK', 'A20-010', 'ud', 8),
  ('equipo', 'ALTAVOZ', 'GENELEC', '4020C', 'ud', 7),
  ('equipo', 'AMPLIFICADOR', 'BITTNER', 'BASIC 400', 'ud', 6),
  ('equipo', 'CÁMARA', 'AVER', 'VC520', 'ud', 11),
  ('equipo', 'CÁMARA', 'AVER', 'VC520+', 'ud', 14),
  ('equipo', 'DISTRIBUIDOR DE VIDEOWALL', 'SAMSUNG', 'SNOWJAU', 'ud', 6),
  ('equipo', 'DOCK STATION', 'TARGUS', 'DOCK-190C', 'ud', 6),
  ('equipo', 'EMBEBEDOR DE AUDIO', 'BLUSTREAM', 'HD11AU', 'ud', 18),
  ('equipo', 'KIT TECLADO Y RATÓN', 'LOGITECH', 'MK700', 'ud', 7),
  ('equipo', 'MICRÓFONO', 'BIAMP', 'TESIRA PARLÉ TCM-X', 'ud', 12),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'TSW-770-BS', 'ud', 6),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'DM65E', 'ud', 6),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB43-B', 'ud', 10),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB55B', 'ud', 6),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB55C', 'ud', 6),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB75C', 'ud', 6),
  ('equipo', 'PC', 'LENOVO', 'THINKCENTRE M910Q', 'ud', 6),
  ('equipo', 'PC', 'LENOVO', 'THINKCENTRE M93P', 'ud', 6),
  ('equipo', 'RECEPTOR VÍDEO', 'CRESTRON', 'DM-NVX-D200', 'ud', 12),
  ('equipo', 'SOPORTE', 'VOGELS', 'PFW 4510', 'ud', 9),
  ('equipo', 'TECLADO INALÁMBRICO', 'LOGITECH', 'K400', 'ud', 10),
  ('equipo', 'TÓTEM CON PANTALLA', 'FONESTAR', 'RL38', 'ud', 6),
  ('equipo', 'TRANSMISOR VÍDEO', 'EXTRON', 'DTP HDMI 230 TX', 'ud', 9),
  ('equipo', 'UNIDAD CONTROL MICROFONÍA', 'BOSCH', 'DCN-CCU2', 'ud', 6),
  ('equipo', 'WEBCAM', 'JABRA', 'PANACAST', 'ud', 6),
  ('equipo', 'BARRA DE VIDEOCONFERENCIA', 'AVER', 'VB342 BARRA', 'ud', 5),
  ('equipo', 'BARRA DE VIDEOCONFERENCIA', 'JABRA', 'PANACAST 50', 'ud', 7),
  ('equipo', 'BASE CARGA MICRÓFONO', 'SHURE', 'SBC203', 'ud', 7),
  ('equipo', 'BOTONERA', 'EXTRON', 'MLC 62 RS CC', 'ud', 5),
  ('equipo', 'CAJA DE CONEXIONES', 'EXTRON', 'CABLE CUBBY 1200 NEGRO 70-1037-02', 'ud', 5),
  ('equipo', 'CÁMARA', 'AVER', 'PTC310H', 'ud', 5),
  ('equipo', 'CÁMARA', 'AVER', 'VC520PRO', 'ud', 13),
  ('equipo', 'DISTRIBUIDOR', 'CRESTRON', 'HD-DA8-4KZ-E', 'ud', 5),
  ('equipo', 'EXTENSOR', 'EXTRON', 'RX DTP3 R 201', 'ud', 5),
  ('equipo', 'PANTALLA', 'PHILIPS', '70BFL2214/12', 'ud', 5),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QM43B', 'ud', 5),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'COMM-TEC', 'CP-MO120', 'ud', 5),
  ('equipo', 'PASADOR', 'LOGITECH', 'SPOTLIGHT', 'ud', 5),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-L690U', 'ud', 5),
  ('equipo', 'PUPITRE', 'BOSCH', 'DCN-IDESK-L', 'ud', 5),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SHURE', 'BLX4R', 'ud', 5),
  ('equipo', 'RECEPTOR DE VÍDEO', 'CRESTRON', 'HD-RX-4KZ-101', 'ud', 5),
  ('equipo', 'TECLADO', 'LOGITECH', 'MX3200', 'ud', 7),
  ('equipo', 'TELÉFONO IP', 'CISCO', 'CP-7937G', 'ud', 5),
  ('equipo', 'TELÉFONO IP', 'CISCO', 'CP-7962G', 'ud', 5),
  ('equipo', 'TRANSMISOR DE VÍDEO', 'CRESTRON', 'HD-TX-4KZ-101', 'ud', 5),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'ROOM KIT PLUS', 'ud', 5),
  ('equipo', 'ALTAVOZ DE TECHO', 'LDA', 'XC-65', 'ud', 4),
  ('equipo', 'ALTAVOZ', 'BOSE', 'DS100SE', 'ud', 4),
  ('equipo', 'ALTAVOZ', 'BOSE', 'FREESPACE', 'ud', 4),
  ('equipo', 'ALTAVOZ', 'BOSE', 'FREESPACE DS 100SE WH', 'ud', 4),
  ('equipo', 'ALTAVOZ', 'BOSE', 'UL 1480', 'ud', 4),
  ('equipo', 'ALTAVOZ', 'MEYER SOUND', 'MM-4XP', 'ud', 4),
  ('equipo', 'ALTAVOZ', 'VIETA', 'DO-8', 'ud', 4),
  ('equipo', 'AMINO', 'TRIPLEPAY', 'TPS-SPI-4', 'ud', 4),
  ('equipo', 'CARGADOR DICENTIS', 'BOSCH', 'DCNM-WCH05', 'ud', 4),
  ('equipo', 'CONTROLADORA', 'AMX', 'NX 1200', 'ud', 5),
  ('equipo', 'CONVERSOR', 'EXTRON', 'RGBHDMI 300A', 'ud', 4),
  ('equipo', 'CÁMARA', 'CANON', 'CR-N300', 'ud', 4),
  ('equipo', 'CÁMARA', 'CISCO', 'CTS-CAM-P60', 'ud', 4),
  ('equipo', 'CÁMARA', 'SONY', 'EVI-X2000C', 'ud', 4),
  ('equipo', 'ESCALADOR', 'EXTRON', 'DVS 605', 'ud', 7),
  ('equipo', 'ESCALADOR', 'EXTRON', 'DVS-605-A', 'ud', 7),
  ('equipo', 'INTERFACE DE AUDIO DANTE, PARA MIC ANALOGICO A DIGITAL DANTE', 'SHURE', 'ANI4IN', 'ud', 4),
  ('equipo', 'MATRIZ', 'EXTRON', 'DTP CROSSPOINT 108', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'CISCO', 'TABLE MICROPHONE', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'E835', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SK2000', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SK2000 558-626 MHZ', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SKM2000 558-626 MHZ', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MXA920W-S', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'SHURE', 'SLXD1', 'ud', 8),
  ('equipo', 'MICRÓFONO', 'SHURE', 'SLXD2', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'SHURE', 'WL185', 'ud', 4),
  ('equipo', 'MONITOR', 'SMART', 'PODIUM 524', 'ud', 5),
  ('equipo', 'PANTALLA', 'IIYAMA', 'LH4340S-B1', 'ud', 4),
  ('equipo', 'PANTALLA', 'PHILIPS', '65PUS6162/12', 'ud', 4),
  ('equipo', 'PANTALLA', 'PIONEER', '43MXE1', 'ud', 4),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'DM55D', 'ud', 4),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'LH55QMBEBGCXE', 'ud', 4),
  ('equipo', 'PANTALLA ELÉCTRICA', 'PLUSSCREEN', 'INACCESIBLE', 'ud', 4),
  ('equipo', 'PASARELA', 'CRESTRON', 'HD-CTL-101', 'ud', 4),
  ('equipo', 'PC', 'HP', '600 MINI G4', 'ud', 4),
  ('equipo', 'PC', 'HP', 'ELITEDESK 800 G5', 'ud', 6),
  ('equipo', 'PC', 'LENOVO', 'M70Q', 'ud', 4),
  ('equipo', 'PROCESADOR DE AUDIO', 'XILICA', 'SOLARO QR1', 'ud', 4),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'TESIRAFORTÉ AVB VT4', 'ud', 5),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-G5300', 'ud', 4),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-L530U', 'ud', 4),
  ('equipo', 'PROYECTOR', 'LG', 'BU50NST', 'ud', 4),
  ('equipo', 'PROYECTOR', 'SONY', 'VPL-FH31', 'ud', 4),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SENNHEISER', 'EM2050 558-626 MHZ', 'ud', 4),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SHURE', 'SLXD4D', 'ud', 8),
  ('equipo', 'SOPORTE', 'INDETERMINADA', 'TECHO', 'ud', 4),
  ('equipo', 'SOPORTE', 'VOGELS', 'PPC 1585 SOPORTE', 'ud', 4),
  ('equipo', 'SWITCH', 'DANTE', 'SWITCH TP- LINK', 'ud', 4),
  ('equipo', 'TÓTEM CON PANTALLA', 'VOGELS', 'SINRUEDAS', 'ud', 5),
  ('equipo', 'UNIDAD CONTROL MICROFONÍA', 'BOSCH', 'DCN-CCU', 'ud', 4),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'CODEC PLUS', 'ud', 5),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'CS-KIT-K9', 'ud', 4),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'ROOM BAR', 'ud', 4),
  ('equipo', 'ALTAVOZ', 'BOSE', 'INACCESIBLE', 'ud', 4),
  ('equipo', 'ALTAVOZ', 'BOSCH', 'LB1-UM20E-D', 'ud', 3),
  ('equipo', 'APPLE TV', 'APPLE', 'APPLE TV 4 GEN', 'ud', 6),
  ('equipo', 'BARRA DE VIDEOCONFERENCIA', 'CISCO', 'ROOM PRO', 'ud', 3),
  ('equipo', 'BOTONERA', 'EXTRON', 'MLC 62 RS', 'ud', 3),
  ('equipo', 'CAJA DE CONEXIONES', 'EXTRON', 'CABLE CUBBY 1200 (202EU)', 'ud', 3),
  ('equipo', 'CAPTURADOR PANTALLA', 'KAPTIVO', 'WALL MOUNT CAMERA', 'ud', 4),
  ('equipo', 'CONVERSOR', 'EXTRON', 'DPM‑HDF 4K PLUS', 'ud', 3),
  ('equipo', 'CONVERSOR CATX - HDMI', 'KAPTIVO', 'KW100', 'ud', 4),
  ('equipo', 'CÁMARA', 'CISCO', 'PRECISION 60', 'ud', 3),
  ('equipo', 'CÁMARA', 'CISCO', 'QUADCAM', 'ud', 3),
  ('equipo', 'CÁMARA', 'LOGITECH', 'GROUP', 'ud', 5),
  ('equipo', 'CÁMARA', 'SONY', 'SRG-A12', 'ud', 3),
  ('equipo', 'DANTE', 'ATTEROTECH', 'UNDIO2X2', 'ud', 3),
  ('equipo', 'DISTRIBUIDOR', 'EXTRON', 'DA6', 'ud', 3),
  ('equipo', 'DOCK STATION', 'TARGUS', 'DOCK192', 'ud', 4),
  ('equipo', 'EMISOR HDBASET', 'CRESTRON', 'HD-TXC-4KZ-101', 'ud', 3),
  ('equipo', 'ESCALADOR', 'EXTRON', 'IN 1608SA', 'ud', 3),
  ('equipo', 'ESCALADOR', 'EXTRON', 'IN1604', 'ud', 3),
  ('equipo', 'MICRO BEAMTRACKING', 'BIAMP', 'TESIRA PARLÉ TCM-1', 'ud', 4),
  ('equipo', 'MICRÓFONO DE TECHO', 'SHURE', 'MXA 920W-S-60', 'ud', 6),
  ('equipo', 'MICROFONÍA', 'BEYERDYNAMIC', 'TG500H-C', 'ud', 3),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SL CEILING MIC 2', 'ud', 3),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX1 H8E', 'ud', 6),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX2 S8', 'ud', 3),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MX418 D/C', 'ud', 4),
  ('equipo', 'MICRÓFONO', 'SHURE', 'PGX4', 'ud', 3),
  ('equipo', 'MICRÓFONO', 'SHURE', 'SR450', 'ud', 3),
  ('equipo', 'MICRÓFONO/ALTAVOZ', 'YEALINK', 'CPE40', 'ud', 4),
  ('equipo', 'PANEL TÁCTIL', 'AMX', 'MSD-431I', 'ud', 3),
  ('equipo', 'PANEL TÁCTIL', 'EXTRON', 'TLP PRO 725M', 'ud', 3),
  ('equipo', 'PANEL TÁCTIL', 'EXTRON', 'TLP PRO 725T', 'ud', 3),
  ('equipo', 'PANTALLA', 'NEC', 'E654', 'ud', 3),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'DM32D', 'ud', 3),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'DM82D', 'ud', 3),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'LH65QBHPLGC/EN', 'ud', 3),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'NP', 'NP', 'ud', 3),
  ('equipo', 'PANTALLA PROYECCIÓN', 'INDETERMINADA', 'P PROYECCION', 'ud', 5),
  ('equipo', 'PASARELA MÓDULO RELÉ', 'CRESTRON', 'CEN-IO-RY-104', 'ud', 7),
  ('equipo', 'PC', 'HP', '600 G4', 'ud', 3),
  ('equipo', 'PC', 'LENOVO', 'M93P', 'ud', 4),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'TESIRAFORTÉ AVB CI', 'ud', 6),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-1915', 'ud', 4),
  ('equipo', 'RATÓN', 'LOGITECH', 'PERFORMANCE MX', 'ud', 4),
  ('equipo', 'RATÓN INALÁMBRICO', 'LOGITECH', 'NP', 'ud', 4),
  ('equipo', 'RECEPTOR HDBASET', 'CRESTRON', 'HD-RXC-4KZ-101', 'ud', 4),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SENNHEISER', 'EM-2050', 'ud', 4),
  ('equipo', 'SELECTOR', 'KRAMER', 'DIP-31', 'ud', 4),
  ('equipo', 'SOPORTE', 'INDETERMINADA', 'SOPORTE', 'ud', 3),
  ('equipo', 'SOPORTE DE ALTAVOZ', 'GENELEC', '8000-422W', 'ud', 5),
  ('equipo', 'SOPORTE DE PARED', 'B. MONJE', 'BM-SLCDRM', 'ud', 8),
  ('equipo', 'SWITCH', 'TP-LINK', 'TL-SG1005LP', 'ud', 3),
  ('equipo', 'TÓTEM', 'INDETERMINADA', 'CON RUEDAS', 'ud', 19),
  ('equipo', 'TÓTEM', 'VOGELS', 'FD 2064 S TOTEM', 'ud', 3),
  ('equipo', 'TÓTEM CON PANTALLA', 'DIMASA', 'CONRUEDAS', 'ud', 4),
  ('equipo', 'TÓTEM CON PANTALLA', 'TRAULUX', 'CONRUEDAS', 'ud', 3),
  ('equipo', 'TÓTEM CON PANTALLA', 'VOGELS', 'CONRUEDAS', 'ud', 4),
  ('equipo', 'TRANSMISOR MICROFONÍA', 'SHURE', 'SLXD2/SM58', 'ud', 3),
  ('equipo', 'TRANSMISOR VÍDEO', 'CRESTRON', 'DM-NVX-351', 'ud', 3),
  ('equipo', 'TRANSMISOR VÍDEO', 'CRESTRON', 'DM-NVX-360', 'ud', 5),
  ('equipo', 'TRANSMISOR VÍDEO', 'EXTRON', 'DTP T USW 233', 'ud', 3),
  ('equipo', 'UNIDAD CONTROL MICROFONÍA', 'BOSCH', 'DCN-CCUB', 'ud', 3),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'EQ', 'ud', 3),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'SX20', 'ud', 3),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'WEBEX BOARD 70', 'ud', 3),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'WEBEX ROOM BAR', 'ud', 3),
  ('equipo', 'COMPARTICIÓN INALÁMBRICA', 'MICROSOFT', '1733.0', 'ud', 3),
  ('equipo', 'ALTAVOZ', 'GENELEC', '4410A', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'THOMANN', 'EV EVID 4.2 BLACK', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'EXTRON', 'SI26X', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'GENELEC', '4010 WM', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'GENELEC', '4020AW', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'GENELEC', '4410 DANTE', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'GENELEC WHITE', '4020C', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'PANPHONICS', 'SSHA120X20', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'XILICA', 'SONIA -C5', 'ud', 4),
  ('equipo', 'AMPLIFICADOR', 'APART', 'MA125', 'ud', 2),
  ('equipo', 'AMPLIFICADOR', 'BOSE', '1600SERIEVI', 'ud', 2),
  ('equipo', 'AMPLIFICADOR', 'BOSE', 'MA200', 'ud', 2),
  ('equipo', 'AMPLIFICADOR', 'AUSTRALIAN MONITOR', 'AMIS 120', 'ud', 3),
  ('equipo', 'AMPLIFICADOR DE MICRÓFONO', 'N-AUDIO', 'MIC1', 'ud', 3),
  ('equipo', 'BARRA DE VIDEOCONFERENCIA', 'AVER', 'VB342+', 'ud', 3),
  ('equipo', 'CABLE C', 'CISCO', 'CAB-USBC-AC-9M', 'ud', 2),
  ('equipo', 'CÁMARA', 'AVER', 'CAM520 PRO3', 'ud', 3),
  ('equipo', 'CAPTURADORA DE VÍDEO', 'ELGATO', 'CAM LINK 4K', 'ud', 2),
  ('equipo', 'COLUMNA FON DLI-130 DANTE', 'FOHHN', 'DLI-130', 'ud', 2),
  ('equipo', 'CONTROL AMPLIFICADORES', 'EXTRON', 'MDL, VCM100 AAP BLACK', 'ud', 2),
  ('equipo', 'CONTROLADORA', 'CRESTRON', 'CP4N', 'ud', 4),
  ('equipo', 'CONVERSOR', 'AUDINATE', 'AVIO-A-2OUT-EB', 'ud', 2),
  ('equipo', 'CÁMARA', 'AVER', 'CAM520 PRO', 'ud', 2),
  ('equipo', 'CÁMARA', 'AVER', 'CAM550', 'ud', 3),
  ('equipo', 'CÁMARA', 'CISCO', 'EVI-X200C', 'ud', 2),
  ('equipo', 'CÁMARA', 'CISCO', 'ROOM VISION PTZ', 'ud', 2),
  ('equipo', 'CÁMARA', 'YEALINK', 'A40-010', 'ud', 2),
  ('equipo', 'DCN - EXPANSOR', 'BOSCH', 'DCN - TYPE LBB 4402/00', 'ud', 2),
  ('equipo', 'DISTRIBUIDOR', 'BIAMP', 'TESIRA CONNECT TC-5', 'ud', 4),
  ('equipo', 'DISTRIBUIDOR', 'BOSCH', 'LBB4402/00', 'ud', 3),
  ('equipo', 'DISTRIBUIDOR', 'EXTRON', 'DA2', 'ud', 2),
  ('equipo', 'EMISOR HDBASET', 'CRESTRON', 'HD-TX-101-C-E', 'ud', 4),
  ('equipo', 'ESCALADOR', 'KRAMER', 'DIP-31M', 'ud', 4),
  ('equipo', 'AMPLIFICADOR', 'MONITOR AUDIO', 'IA 60-12', 'ud', 2),
  ('equipo', 'AMPLIFICADOR', 'QSC', 'CX-Q 2K4', 'ud', 2),
  ('equipo', 'EXTENSOR', 'CRESTRON', 'HD-RXU-4KZ-101-E', 'ud', 2),
  ('equipo', 'FLIPCHART', 'SAMSUNG', 'WM55H', 'ud', 2),
  ('equipo', 'INTERFAZ DE AUDIO', 'BEHRINGER', 'UCA202', 'ud', 2),
  ('equipo', 'MATRIZ', 'EXTRON', 'DTP CROSSPOINT 108 4K', 'ud', 2),
  ('equipo', 'MEZCLADOR DE AUDIO', 'BIAMP', 'NEXIA VC', 'ud', 2),
  ('equipo', 'MICROFONÍA', 'SHURE', 'MX396', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'CISCO', 'CEILING MICROPHONE PRO', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'CISCO', 'TELEPRESENCE TABLE MICROPHONE 20', 'ud', 3),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SK', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SK2000 516-558 MHZ', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SKM-S', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SKM2000 516-558 MHZ', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX 1 HBE', 'ud', 3),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX 1 S8', 'ud', 3),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX24R/SM58', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX288/PG58-H8E', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX4R H8E', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MX920-S', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MXA920', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MXA920 SQUARE ROUND BLANCO', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'PG58', 'ud', 2),
  ('equipo', 'MICRÓFONO MESA', 'SHURE', 'MIX 396/C TRI', 'ud', 2),
  ('equipo', 'MONITOR', 'NEWLINE', 'FLEX', 'ud', 2),
  ('equipo', 'MONITOR', 'NEWLINE', 'TT-2721', 'ud', 2),
  ('equipo', 'MONITOR', 'NEWLINE', 'X7', 'ud', 4),
  ('equipo', 'MONITOR', 'SAMSUNG', 'QM55C', 'ud', 2),
  ('equipo', 'MONITOR', 'SAMSUNG', 'QMC43C', 'ud', 2),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'ST 1700C', 'ud', 2),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'TSW-1070-B-S', 'ud', 2),
  ('equipo', 'PANTALLA', 'PHILIPS', '55BDL3050Q', 'ud', 4),
  ('equipo', 'PANTALLA', 'PHILIPS', '70BFL2214', 'ud', 2),
  ('equipo', 'PANTALLA', 'PIONEER', 'KRP-600M', 'ud', 2),
  ('equipo', 'PANTALLA', 'SAMSUNG', '"65"""', 'ud', 2),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'LH55DME', 'ud', 2),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'LH65QBREBGCXEN', 'ud', 2),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'LH85QMNE', 'ud', 2),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB50B', 'ud', 2),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB65', 'ud', 2),
  ('equipo', 'PANTALLA', 'SONY', '55XE8001', 'ud', 2),
  ('equipo', 'PANTALLA', 'SONY', '65XE8501', 'ud', 2),
  ('equipo', 'PANTALLA', 'SONY', 'BRAVIA KDL-48W605B', 'ud', 2),
  ('equipo', 'PANTALLA', 'SONY', 'FE-65XE8501', 'ud', 2),
  ('equipo', 'PANTALLA', 'SONY', 'KD-75XE9405', 'ud', 2),
  ('equipo', 'PANTALLA', 'SONY', 'KDL-65HX920', 'ud', 2),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'BALTA', 'PE300-2WCB', 'ud', 2),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'INDETERMINADA', 'PROYECCION INDETERMINADO', 'ud', 3),
  ('equipo', 'PASADOR', 'LOGITECH', 'WIRELESS PRESENTER R400', 'ud', 2),
  ('equipo', 'PASARELA MÓDULO RELÉ', 'UNBRANDED', 'HHC-N8I8OP', 'ud', 2),
  ('equipo', 'PC', 'HP', 'COMPAQ', 'ud', 2),
  ('equipo', 'PC', 'HP', 'PRODESK G4', 'ud', 2),
  ('equipo', 'PC', 'LENOVO', '8300.0', 'ud', 2),
  ('equipo', 'PC', 'LENOVO', '920Q', 'ud', 2),
  ('equipo', 'PC', 'LENOVO', 'M910', 'ud', 2),
  ('equipo', 'PLAYER CARTELERÍA', 'BRIGHTSIGN', 'XD1034', 'ud', 2),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'TESIRAFORTÉ CI', 'ud', 3),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'TESIRAFORTÉ DAN CI', 'ud', 3),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'FORTE AL', 'ud', 2),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'NEXIA', 'ud', 2),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-1955', 'ud', 3),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-1980WU', 'ud', 2),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-G5600', 'ud', 2),
  ('equipo', 'PROYECTOR', 'EPSON', 'L630U', 'ud', 2),
  ('equipo', 'PROYECTOR', 'MITSUBISHI', 'XL1U', 'ud', 2),
  ('equipo', 'PROYECTOR', 'MITSUBISHI', 'XL30U', 'ud', 2),
  ('equipo', 'PROYECTOR', 'PANASONIC', 'PTMZ670', 'ud', 2),
  ('equipo', 'PROYECTOR', 'SONY', 'VPL-FHZ65', 'ud', 2),
  ('equipo', 'PULSADORES PANTALLAS', 'CRESTRON', 'DIN-8SW8-I', 'ud', 2),
  ('equipo', 'RACK HORIZONTAL SALAS VIDEOCONFERENCIA', 'ADVANTIS', 'PC14 - 10670', 'ud', 2),
  ('equipo', 'RATÓN', 'LOGITECH', 'MX MASTER', 'ud', 2),
  ('equipo', 'RECEPTOR DE VÍDEO', 'CRESTRON', 'HD-RX-101-C-E', 'ud', 4),
  ('equipo', 'RECEPTOR DE VÍDEO', 'MATROX', 'DM-NVX-D30', 'ud', 2),
  ('equipo', 'RECEPTOR HDBASET', 'CRESTRON', 'HD-RX-4K-410-C-E', 'ud', 2),
  ('equipo', 'RECEPTOR MICROFONÍA', 'SHURE', 'BLX88 H8E', 'ud', 2),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SENNHEISER', 'EM2050 516-558 MHZ', 'ud', 2),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SENNHEISER', 'EW-D EM', 'ud', 2),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SHURE', 'BLX88', 'ud', 4),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SHURE', 'ULXP4', 'ud', 2),
  ('equipo', 'RECEPTOR VÍDEO', 'CRESTRON', 'DM-NVX-D351', 'ud', 2),
  ('equipo', 'REPRODUCTOR', 'BRIGHTSIGN', 'LS423', 'ud', 2),
  ('equipo', 'SOPORTE', 'B-TECH AV MOUNTS', 'BT7052', 'ud', 2),
  ('equipo', 'SOPORTE DE PANTALLA', 'CHIEF', 'CM2L40UI', 'ud', 2),
  ('equipo', 'SOPORTE DE PANTALLA', 'HILTON', 'C2P2', 'ud', 3),
  ('equipo', 'SOPORTE DE PARED', 'B. MONJE', 'BM-SLCDRG', 'ud', 2),
  ('equipo', 'SOPORTE DE PROYECTOR', 'VOGELS', 'PPC 1585', 'ud', 4),
  ('equipo', 'SUBWOOFER DE TECHO', 'MONITOR AUDIO', 'ICS-8', 'ud', 2),
  ('equipo', 'SWITCH', 'EXTRON', 'DTP T DSW 4K 333', 'ud', 2),
  ('equipo', 'SWITCH', 'EXTRON', 'SW4 HD 4K', 'ud', 3),
  ('equipo', 'SWITCH', 'NETGEAR', 'GS308EPP', 'ud', 2),
  ('equipo', 'SWITCH POE', 'NETGEAR', 'GS305P', 'ud', 2),
  ('equipo', 'TARJETA DANTE', 'EXTRON', 'AXI 22 AT', 'ud', 2),
  ('equipo', 'TECLADO', 'LOGITECH', 'WIRELESS SOLAR K750', 'ud', 2),
  ('equipo', 'TECLADO Y RATÓN', 'LOGITECH', 'MK700/MK710', 'ud', 2),
  ('equipo', 'TECLADO/RATÓN', 'LOGITECH', 'MX 5500', 'ud', 3),
  ('equipo', 'TELÉFONO IP', 'CISCO', 'CP-8831', 'ud', 3),
  ('equipo', 'TÓTEM CON PANTALLA', 'DIMASA', 'FLEX-R', 'ud', 5),
  ('equipo', 'TÓTEM CON PANTALLA', 'STYLU', 'HILTON C2P2', 'ud', 3),
  ('equipo', 'TRANSMISOR AUDIO', 'JUST ADD POWER', 'VBS-HDIP705 POE', 'ud', 2),
  ('equipo', 'TRANSMISOR RADIADOR', 'BOSCH', 'INT-TX04', 'ud', 2),
  ('equipo', 'TRANSMISOR VÍDEO', 'EXTRON', 'DTP T DSW 4K 233', 'ud', 4),
  ('equipo', 'TRANSMISOR VÍDEO', 'GEFEN', 'TOOLBOX', 'ud', 2),
  ('equipo', 'UNIDAD CONTROL MICROFONÍA', 'DICENTIS', 'DCNM-WAP', 'ud', 2),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'BOARD 70', 'ud', 2),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'CS-DESK-K9', 'ud', 2),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'MINI SPARK ROOM KIT', 'ud', 2),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'WEBEX BOARD PRO 55', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'BOSE', 'LIFESTYLE N123', 'ud', 1),
  ('equipo', 'ALTAVOZ', 'GENELEC', '8000-444B', 'ud', 1),
  ('equipo', 'ALTAVOZ', 'GENIUS', 'PT', 'ud', 1),
  ('equipo', 'ALTAVOZ', 'HERCULES', 'XPS 2.0 35 USB', 'ud', 1),
  ('equipo', 'ALTAVOCES (X14)', 'SONY', 'INACCESIBLE', 'ud', 1),
  ('equipo', 'ALTAVOZ', 'LOGITECH', '886-000056', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'PANPHONICS', 'AA-160', 'ud', 2),
  ('equipo', 'ALTAVOZ', 'YAMAHA', 'MS101-4', 'ud', 1),
  ('equipo', 'AMINO', 'NEMKO', 'H140', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'AMPETRONIC', 'C10 -1 N', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'BITTNER', 'BASIC 800', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'BOSE', '2150.0', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'CAMCO', 'VORTEX 2.6', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'CREST', 'CPX-1500', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'CROWN', 'CTS 1200', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'EAW', 'CAZ800', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'EXTRON', 'DTP HD DA8 4K 230', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'EXTRON', 'MPA 122 MINI POWER AMPLIFIER', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'XILICA', 'SONIA AMP', 'ud', 2),
  ('equipo', 'ANTENA', 'SHURE', 'BLX88 S8', 'ud', 1),
  ('equipo', 'ANTENA UA8 SHURE', 'SHURE', 'UA8-518-598', 'ud', 1),
  ('equipo', 'APPLE TV', 'APPLE', '3ªGEN', 'ud', 1),
  ('equipo', 'AUDIOCONFERENCIA', 'POLYCOM', 'SOUNDSTATION2', 'ud', 1),
  ('equipo', 'BARRA DE VIDEOCONFERENCIA', 'CRESTRON', 'US-CB- 1CAM', 'ud', 1),
  ('equipo', 'BARRA DE VIDEO', 'YEALINK', 'MEETING BAR A30', 'ud', 2),
  ('equipo', 'BARRA SONIDO', 'POLKAUDIO', 'SURROUNDBAR3000', 'ud', 1),
  ('equipo', 'BASE MICRO INALAMBRICO', 'YEALINK', 'CDW90', 'ud', 1),
  ('equipo', 'BOTONERA', 'EXTRON', 'CABLE CUBBY 1202', 'ud', 1),
  ('equipo', 'CAJA ACÚSTICA', 'SOUNDTUBE', 'RS500I', 'ud', 1),
  ('equipo', 'CAJAS ACÚSTICAS', 'GENELEC', '4010AW-6', 'ud', 1),
  ('equipo', 'CÁMARA', 'LOGITECH', 'C-U0036', 'ud', 2),
  ('equipo', 'CAPTURADORA', 'BLACKMAGIC', 'ULTRASTUDIO 4K MINI', 'ud', 1),
  ('equipo', 'CD MULTICOMP', 'PIONEER', 'PD-M426', 'ud', 1),
  ('equipo', 'CONMUTADOR 2/1 VGA', 'EXTRON', 'P/2 DA2XI MT', 'ud', 1),
  ('equipo', 'CONTROL PROCESOR', 'CRESTRON', 'PRO 2 PROFESSIONAL RACK2', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'AMX', 'NI-700', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'CRESTRON', 'CP-3', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'CRESTRON', 'CP4', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'DATAPATH', 'HX4', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'EXTRON', 'IPCP 250 PRO', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'EXTRON', 'IPCP PRO 250 1843', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'EXTRON', 'IPCP PRO 550', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'LG', 'CVBA', 'ud', 1),
  ('equipo', 'CONTROLADORA', 'NOVASTAR', 'VX600', 'ud', 1),
  ('equipo', 'CONTROLADORA DE VIDEOWALL', 'NOVASTAR', 'VX400', 'ud', 1),
  ('equipo', 'CONTROLADORA DE VIDEOWALL', 'DATAPATH', 'VSN1172', 'ud', 2),
  ('equipo', 'CONVERSOR', 'BEHRINGER', 'ULTRAGAIN PRO-8', 'ud', 1),
  ('equipo', 'CONVERSOR', 'INOGENI', 'U-CAM', 'ud', 1),
  ('equipo', 'CÁMARA', 'AVER', '342+', 'ud', 1),
  ('equipo', 'CÁMARA', 'AVER', '520PRO', 'ud', 1),
  ('equipo', 'CÁMARA', 'AVER', 'P0-A5-AVER', 'ud', 1),
  ('equipo', 'CÁMARA', 'AVER', 'PTC 500S', 'ud', 2),
  ('equipo', 'CÁMARA', 'AVER', 'PTZ 330', 'ud', 1),
  ('equipo', 'CÁMARA', 'AVER CONFERENCE', 'VC520', 'ud', 1),
  ('equipo', 'CÁMARA', 'CANON', 'CR-N100', 'ud', 1),
  ('equipo', 'CÁMARA', 'CISCO', 'PRECISION HD 1080P', 'ud', 1),
  ('equipo', 'CÁMARA', 'CISCO', 'TTC8-02', 'ud', 1),
  ('equipo', 'CÁMARA', 'YEALINK', 'UVC85', 'ud', 2),
  ('equipo', 'DCN', 'BOSCH', 'INT-TX08', 'ud', 2),
  ('equipo', 'DCN - INFRARROJOS', 'BOSCH', 'DCN INT TX08', 'ud', 1),
  ('equipo', 'DIGITAL SYSTEMCONVERSION', 'SAMSUNG', 'SV-5000W', 'ud', 1),
  ('equipo', 'DISTRIBUIDOR', 'CRESTRON', 'HD DA4 4KZ E', 'ud', 2),
  ('equipo', 'ESCALADOR', 'CRESTRON', 'HD-PS402', 'ud', 2),
  ('equipo', 'DISTRIBUIDOR', 'EXTRON', 'DA4 HD 4K PLUS', 'ud', 1),
  ('equipo', 'DISTRIBUIDOR', 'EXTRON', 'SW4 DVI A PLUS', 'ud', 1),
  ('equipo', 'DISTRIBUIDOR', 'SHURE', 'UA884SWB', 'ud', 1),
  ('equipo', 'DISTRIBUIDOR', 'EXTRON', 'HDMI D6', 'ud', 1),
  ('equipo', 'DISTRIBUIDOR', 'EXTRON', 'HDMI DA2', 'ud', 1),
  ('equipo', 'DISTRIBUIDOR', 'EXTRON', 'DTP HD DA8 230', 'ud', 1),
  ('equipo', 'DISTRIBUIDOR', 'KRAMER', 'VM-2HXL', 'ud', 1),
  ('equipo', 'DOCK STATION', 'TARGUS', 'DOCK180', 'ud', 1),
  ('equipo', 'DONGLE MSDISPLAY', 'MICROSOFT', 'WIRELESS DISPLAY ADAPTER', 'ud', 1),
  ('equipo', 'DONGLE MSDISPLAY', 'MICROSOFT', 'WIRELESS DISPLAY ADAPTER NUEVO', 'ud', 1),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'FORTÉ DAN VT4', 'ud', 1),
  ('equipo', 'PROCESADOR DE AUDIO', 'Q-SYS', 'FLEX 8', 'ud', 1),
  ('equipo', 'PROCESADOR DE AUDIO', 'TESIRA', '12*8', 'ud', 1),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'TESIRA FORTÉ AI', 'ud', 2),
  ('equipo', 'PROCESADOR DE AUDIO', 'CRESTRON', 'DSP-1283', 'ud', 1),
  ('equipo', 'DVC PRO', 'PANASONIC', 'AJ-D250', 'ud', 1),
  ('equipo', 'DVD', 'JVC', 'XV-N316', 'ud', 1),
  ('equipo', 'DVD', 'PIONEER', 'DV-340', 'ud', 1),
  ('equipo', 'EMISOR HDBASET', 'STC', 'RC5-CE', 'ud', 1),
  ('equipo', 'EMISOR USB', 'BLACK BOX', 'IC408A', 'ud', 2),
  ('equipo', 'ESCALADOR', 'EXTRON', '605.0', 'ud', 1),
  ('equipo', 'ESCALADOR', 'EXTRON', 'IN 1608XI', 'ud', 2),
  ('equipo', 'ESCALADOR', 'EXTRON', 'IN1606', 'ud', 3),
  ('equipo', 'ESCALADOR', 'KRAMER', 'VP-440X', 'ud', 1),
  ('equipo', 'ESCALADOR', 'KRAMER', 'VP-461', 'ud', 1),
  ('equipo', 'ESCALADOR', 'KRAMER', 'VS 211XS', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'CRESTRON', 'CPX 1500', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'CROWN', 'XLI 800', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'LDA', 'MAP6-100', 'ud', 1),
  ('equipo', 'AMPLIFICADOR', 'RCS', 'BA - 120C', 'ud', 1),
  ('equipo', 'ETAPA POTENCIA', 'CREST', 'CPX 900', 'ud', 1),
  ('equipo', 'EXPANSOR', 'AMX', 'EXB-COM2', 'ud', 1),
  ('equipo', 'EXTENSOR', 'ATEN', 'UE3310', 'ud', 1),
  ('equipo', 'EXTENSOR', 'GEFEN', 'EXT-DVI-1CAT5-SR-CO', 'ud', 1),
  ('equipo', 'EXTENSOR', 'GEFEN', 'EXTENDER FOR HDMI DTV S', 'ud', 1),
  ('equipo', 'EXTENSOR BYOD', 'YEALINK', 'MVC', 'ud', 1),
  ('equipo', 'EXTENSOR', 'EXTRON', 'TX DTP3 R 201', 'ud', 1),
  ('equipo', 'GRABADOR', 'EXTRON', 'SMP 300', 'ud', 1),
  ('equipo', 'GRABADOR', 'MATROX', 'MONARCH LCS', 'ud', 1),
  ('equipo', 'GW.MIDI', 'ETC', 'RSN-MIDI-P', 'ud', 1),
  ('equipo', 'HANG OUTERS', 'POLYCOM', 'POLYCOMSTUDIO', 'ud', 1),
  ('equipo', 'INTERFAZ DE AUDIO', 'FOCURSITE SCARLETT', '18I8', 'ud', 1),
  ('equipo', 'IPAD', 'APPLE', 'MR7G2TY', 'ud', 1),
  ('equipo', 'KIT TECLADO Y RATÓN', 'LENOVO', 'KU-1619', 'ud', 1),
  ('equipo', 'KIT TECLADO Y RATÓN', 'LOGITECH', 'K850', 'ud', 2),
  ('equipo', 'KIT TECLADO Y RATÓN', 'LOGITECH', 'Y-RAL57', 'ud', 1),
  ('equipo', 'MALETA RACK PRENSA', 'PINANSON', 'SA SMC 32', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'CROSSPOINT 84 4K', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'DMP 128 PLUS', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'DTP CROSSPOINT 1608 4K', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'DTP CROSSPOINT 82 4K', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'DTP CROSSPOINT 84 4K', 'ud', 2),
  ('equipo', 'MATRIZ', 'EXTRON', 'CROSSPOINT 108 4K', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'IN1608', 'ud', 2),
  ('equipo', 'MATRIZ', 'EXTRON', 'MMX 32 VGA A', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'MVX SERIES', 'ud', 2),
  ('equipo', 'MATRIZ', 'LIGHTWARE', 'MMX8X8-HDMI-4K-A-USB20', 'ud', 1),
  ('equipo', 'MATRIZ', 'SHURE', 'ANIUSB-MATRIX', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'CROSSPOINT SERIES WITCHES', 'ud', 1),
  ('equipo', 'MATRIZ', 'EXTRON', 'DTP3 CROSSPOINT 884', 'ud', 1),
  ('equipo', 'MESA DE MEZCLAS', 'YAMAHA', '01V96', 'ud', 3),
  ('equipo', 'MEZCLADOR DE AUDIO', 'SOUNDCRAFT', 'EPM6', 'ud', 1),
  ('equipo', 'MESA SONIDO', 'SOUNDCRAFT', 'SPIRIT DIGITAL 328', 'ud', 1),
  ('equipo', 'MEZCLADOR DE AUDIO', 'BIAMP', 'TESIRAFORTÉ VI', 'ud', 2),
  ('equipo', 'MEZCLADOR DE AUDIO', 'EXTRON', 'MVC 121 PLUS', 'ud', 2),
  ('equipo', 'MEZCLADOR DE AUDIO', 'QSC', 'Q-SYS CORE 11OF', 'ud', 1),
  ('equipo', 'MEZCLADOR DE AUDIO', 'QSC', 'Q-SYS CORE 8 FLEX', 'ud', 1),
  ('equipo', 'MEZCLADOR DE AUDIO', 'EXTRON', 'MVC 121', 'ud', 1),
  ('equipo', 'MICRO LAVALIER', 'SHURE', 'SHURE 185', 'ud', 1),
  ('equipo', 'MICRO SETA CÁMARA', 'AVER', 'VC520 PRO SPKPH', 'ud', 1),
  ('equipo', 'MICROFONOS', 'SHURE', 'BLX1288/MX53', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'AKG', 'HT40', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'AUDIO-TECHNICA', 'ATND1061', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'AVER', '60U0100000AB', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'BEYERDYNAMIC', 'TG 1000', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'CISCO', 'TABLE 20 TTC5-06', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'CISCO', 'TTC5-06', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'DICENTIS', 'DCNM-WDE', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'LOGITECH', '989-000171', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'OPUS', 'NE500', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'HSP2 CLIP', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'MKE 2-EW GOLD', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SENNHEISER', 'SKM 2000', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'A412B', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX1288', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX1288E', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX2 H8E', 'ud', 2),
  ('equipo', 'MICRÓFONO', 'SHURE', 'BLX2 HBE', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MICROFLEX A412B', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MX418 D/N', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MX418/D', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MX53', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MXA920W', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MXA920W DANTE', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'MXA310W', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'SHURE', 'SM58', 'ud', 1),
  ('equipo', 'MICRÓFONO', 'YEALINK', 'CP50', 'ud', 1),
  ('equipo', 'MICRÓFONO/ALTAVOZ', 'YEALINK', 'CPE50', 'ud', 1),
  ('equipo', 'MINI AMPLIFICADOR', 'ECLER', 'CA120', 'ud', 1),
  ('equipo', 'COMPARTICIÓN INALÁMBRICA', 'APPLE', 'APPLE TV', 'ud', 1),
  ('equipo', 'COMPARTICIÓN INALÁMBRICA', 'MICROSOFT', 'MS DISPLAY ADAPTER', 'ud', 1),
  ('equipo', 'MONITOR', 'ALBIRAL', '17AIVM DVI', 'ud', 1),
  ('equipo', 'MONITOR', 'DELL', '2407WFTB', 'ud', 1),
  ('equipo', 'MONITOR', 'DELL', 'P1917S', 'ud', 1),
  ('equipo', 'MONITOR', 'FLEX NEWLINE', 'FLEX - TT-2721', 'ud', 1),
  ('equipo', 'MONITOR', 'HP', 'E24 G4 FHD', 'ud', 1),
  ('equipo', 'MONITOR', 'LG', '75XS4P-B', 'ud', 1),
  ('equipo', 'MONITOR', 'LG', 'FLATRON M3200C-SAF', 'ud', 1),
  ('equipo', 'MONITOR', 'NEWLINE', 'TT-2721AI0', 'ud', 1),
  ('equipo', 'MONITOR', 'PHILIPS', 'B-LINE 70BFL2214/12', 'ud', 1),
  ('equipo', 'MONITOR', 'PHILIPS', 'BRILLIANCE 19B1CB/00', 'ud', 1),
  ('equipo', 'MONITOR', 'SAMSUNG', '713BM', 'ud', 1),
  ('equipo', 'MONITOR', 'SAMSUNG', 'SYNCMASTER 320 PX', 'ud', 1),
  ('equipo', 'MONITOR', 'SAMSUNG', 'UE60J6200AK', 'ud', 2),
  ('equipo', 'MONITOR', 'SMARTPODIUM', 'ID422W', 'ud', 1),
  ('equipo', 'MONITOR', 'SONY', 'FWD 32LX1R', 'ud', 1),
  ('equipo', 'MONITOR', 'SONY', 'FWD- 46EX650P', 'ud', 1),
  ('equipo', 'MONITOR', 'SONY', 'TV *01', 'ud', 1),
  ('equipo', 'MONITOR TRABAJO/REF.', 'DELL', 'E228WFPC', 'ud', 1),
  ('equipo', 'MONITOR TRABAJO/REF.', 'NEWLINE', 'S34A650UBU', 'ud', 1),
  ('equipo', 'MONITOR TRABAJO/REF.', 'SAMSUNG', 'LS34A650UBUXE', 'ud', 1),
  ('equipo', 'MONITOR TÁCTIL', 'AVOCOR', 'AV6530', 'ud', 2),
  ('equipo', 'MONITOR TÁCTIL', 'SMART', 'PODIUM ID422W', 'ud', 1),
  ('equipo', 'MUEBLE', 'VOGELS', 'PVF 4112', 'ud', 1),
  ('equipo', 'MULTIVENTANA', 'BLUSTREAM', 'AMF41W', 'ud', 2),
  ('equipo', 'MULTIVENTANA', 'CRESTRON', 'HD-WP-4K-401-C', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'AMX', 'MST 701', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'AMX', 'MST-431I', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'AMX', 'MST-701I', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'AMX', 'MXT-701', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'CISCO', 'TOUCH 10 TTC5-09', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'CISCO', 'WEBEX ROOM NAVIGATOR', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'LC 3000B', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'TS-1070-B-S', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'TS-770 (M201923005)', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'TSS-70', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'TSW-1060-B-S', 'ud', 1),
  ('equipo', 'PANEL TÁCTIL', 'CRESTRON', 'TSW-760-B-S', 'ud', 1),
  ('equipo', 'PANTALLA', 'AVOCOR', 'AVE8630', 'ud', 1),
  ('equipo', 'PANTALLA', 'HUAWEI', 'IFP-UG65', 'ud', 1),
  ('equipo', 'PANTALLA', 'NEW LINE LYRA', 'TT-5521Q', 'ud', 1),
  ('equipo', 'PANTALLA', 'PANASONIC', 'TH-42PF30ER', 'ud', 1),
  ('equipo', 'PANTALLA', 'PANASONIC', 'TH-50PF20ER', 'ud', 1),
  ('equipo', 'PANTALLA', 'PHILIPS', '50PUS6162/12', 'ud', 1),
  ('equipo', 'PANTALLA', 'PLUSSCREEN', '135” PE300-2WF', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', '320P', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', '75.0', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'LH65QBHPLGC/EN- QB65H', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'ME95C', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'P0-A5-MON-65', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'PS51D450A2WXXC', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'Q875B', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB75B', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB75H', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB85C', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QB875R', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QBC-65', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QM75C', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QM75R-B', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'QM98T-B', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'SYNCMASTER 710N', 'ud', 1),
  ('equipo', 'PANTALLA', 'SAMSUNG', 'UE40B6000', 'ud', 1),
  ('equipo', 'PANTALLA', 'SONY', 'BRAVIA65W855A', 'ud', 1),
  ('equipo', 'PANTALLA', 'SONY', 'BRAVIAKDL46EX653', 'ud', 1),
  ('equipo', 'PANTALLA', 'SONY', 'FW - X8570C', 'ud', 1),
  ('equipo', 'PANTALLA', 'SONY', 'FW-55XE8001', 'ud', 1),
  ('equipo', 'PANTALLA', 'SONY', 'KD 65X8505B', 'ud', 2),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'ELECOM 2', 'ELECOM-2 PRO', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'ELITE SCREENS', 'PE300-2WCB', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'ELITE SCREENS', 'PE300-2WCB PREMIUM FRONTAL', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'ELITE SCREENS', 'SK110NXW-E10', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'ELITE SCREENS', 'STARLING 120', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'INDETERMINADA', 'PANTALLAPROYECCIÓN', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'INDETERMINADA', 'PROYECCION INDETERMINADA', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'SPACE', 'ADTP_TO', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'SPACE', 'NP', 'ud', 1),
  ('equipo', 'PANTALLA ELÉCTRICA', 'ELITE SCREENS', 'ELECTRIC100XH', 'ud', 1),
  ('equipo', 'PANTALLA ELÉCTRICA', 'SCREEN LINE', 'SCREEN LINE', 'ud', 1),
  ('equipo', 'PANTALLA DE PROYECCIÓN', 'COMMTEC SCREEN', 'ELECTRIC MASTER II', 'ud', 1),
  ('equipo', 'PANTALLA TÁCTIL', 'EXTRON', 'TLP PRO 1220 MG', 'ud', 1),
  ('equipo', 'PASADOR', 'LOGITECH', '1911LZ0A1MQ9', 'ud', 1),
  ('equipo', 'PASADOR', 'LOGITECH', 'R400', 'ud', 2),
  ('equipo', 'PASARELA', 'PLANET', 'ICS-110', 'ud', 1),
  ('equipo', 'PASARELA RELÉ', 'GUDE', 'EXPERT POWER CONTROL 2304-1', 'ud', 1),
  ('equipo', 'PASARELA RS232', 'CRESTRON', 'CEN-IO-COM-102', 'ud', 1),
  ('equipo', 'PC', 'FUJITSUSIEMENS', 'ESPRIMO', 'ud', 1),
  ('equipo', 'PC', 'HP', '600 G4 DESKTOP MINI', 'ud', 1),
  ('equipo', 'PC', 'HP', '600 G4 MINI', 'ud', 1),
  ('equipo', 'PC', 'HP', 'COMPAQ PRODESK 600 G4 DM', 'ud', 2),
  ('equipo', 'PC', 'HP', 'ELITE DESK 800 G5 DESKTOP MINI', 'ud', 1),
  ('equipo', 'PC', 'HP', 'ELITEDESK 800 G3 MINI', 'ud', 1),
  ('equipo', 'PC', 'HP', 'ELITEDESK 800 G4 SFF', 'ud', 1),
  ('equipo', 'PC', 'HP', 'ELITEDESK SFF 800 G5', 'ud', 1),
  ('equipo', 'PC', 'HP', 'ELITEDESK SFF 800 G9', 'ud', 1),
  ('equipo', 'PC', 'HP', 'PROBOOK 640 G2', 'ud', 1),
  ('equipo', 'PC', 'HP', 'PRODESK 600 G4 DM', 'ud', 1),
  ('equipo', 'PC', 'HP', 'PRODESK 600D4', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', '10V8S01F00', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', '910Q', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'M10B4', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'M10Q', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'M70Q GEN5', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'M72 I3', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'M92P', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'M93 I3', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'THINKCARE M72E I3', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'THINKCARE M73', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'THINKCARE M93P', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'THINKCENTRE M920', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'THINKCENTRE M920 TINY', 'ud', 1),
  ('equipo', 'PC', 'LENOVO', 'TINY', 'ud', 1),
  ('equipo', 'PC', 'LENOVO TINY', 'THINKCENTRE M920Q', 'ud', 1),
  ('equipo', 'PC', 'PT', 'PT', 'ud', 1),
  ('equipo', 'PC', 'HP', 'PRODESK', 'ud', 1),
  ('equipo', 'PIZARRA INTERACTIVA', 'LOGITECH', 'SCRIBE', 'ud', 1),
  ('equipo', 'PORTATIL', 'HP', 'PROBOOK 640', 'ud', 1),
  ('equipo', 'PRESENTADOR', 'BARCO', 'CLICK SHARE', 'ud', 1),
  ('equipo', 'PRESENTATION PDD', 'YEALINK', 'WPP3D', 'ud', 1),
  ('equipo', 'PREVIO AUDIO USB', 'BOSE', 'TONEMATCH T1', 'ud', 1),
  ('equipo', 'PREVIO BEHRINGER', 'BEHRINGER', 'ULTRAGAIN PRO 8 DIGITAL (ADA8000)', 'ud', 1),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'TARJETA DANTE', 'ud', 1),
  ('equipo', 'PROCESADOR DE AUDIO', 'Q-SYS', 'CORE 8 FLEX', 'ud', 2),
  ('equipo', 'PROCESADOR DE AUDIO', 'QSC', 'CORE 24 F', 'ud', 2),
  ('equipo', 'PROCESADOR DE AUDIO', 'TESIRA', 'FORTE VI', 'ud', 1),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'TESIRA', 'ud', 1),
  ('equipo', 'PROCESADOR DE AUDIO', 'BIAMP', 'TESIRAFORTÉ', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EMP-1825', 'KG5F8Y0246L', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', '1825 3LCD', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', '1915.0', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', '1985WU', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB- 1985WU', 'ud', 3),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB- 810E', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-1485F', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-1825', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-2040', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-700U', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-805F', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-L610U', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB1830', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EMP 1815', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EMP-1825', 'ud', 1),
  ('equipo', 'PROYECTOR', 'EPSON', 'EMP-830', 'ud', 2),
  ('equipo', 'PROYECTOR', 'EPSON', 'NP', 'ud', 1),
  ('equipo', 'PROYECTOR', 'HITACHI', 'CP-RX94', 'ud', 1),
  ('equipo', 'PROYECTOR', 'MITSUBISHI', 'X400BU', 'ud', 1),
  ('equipo', 'PROYECTOR', 'MITSUBISHI', 'XL9U', 'ud', 1),
  ('equipo', 'PROYECTOR', 'NEC', 'P605UL', 'ud', 1),
  ('equipo', 'PROYECTOR', 'NEC', 'P627UL', 'ud', 1),
  ('equipo', 'PROYECTOR', 'PANASONIC', 'PT-VMZ61', 'ud', 1),
  ('equipo', 'PROYECTOR', 'SONY', 'VPL-FHZ131L', 'ud', 1),
  ('equipo', 'PROYECTOR', 'SONY', 'VPL-FHZ700L', 'ud', 1),
  ('equipo', 'PROYECTOR', 'TOSHIBA', 'T350', 'ud', 1),
  ('equipo', 'PROYECTOR', 'TOSHIBA', 'TDP-T355', 'ud', 1),
  ('equipo', 'PROYECTOR', 'VPL', 'VPL-PHZ10', 'ud', 1),
  ('equipo', 'PUPITRE', 'BOSCH', 'DCN-IDESK-D', 'ud', 1),
  ('equipo', 'RADIADOR IR', 'BOSCH', 'LBB4511/00', 'ud', 1),
  ('equipo', 'RATÓN', 'LOGITECH', 'MX 3200 LASER', 'ud', 1),
  ('equipo', 'RATÓN INALÁMBRICO', 'LOGITECH', 'MX5500 REVOLUTION', 'ud', 2),
  ('equipo', 'RECEPTOR DE VÍDEO', 'EXTRON', 'DTP 60-1271-13', 'ud', 1),
  ('equipo', 'RECEPTOR DE VÍDEO', 'EXTRON', 'DTP HDMI 230 RX', 'ud', 1),
  ('equipo', 'RECEPTOR AUDIO', 'SHURE', 'BLX88 RECEPTOR', 'ud', 1),
  ('equipo', 'RECEPTOR HDBASET', 'SCT', 'RC5-HE', 'ud', 1),
  ('equipo', 'RECEPTOR DE MICRÓFONO', 'SHURE', 'BLX1288E/W85-H8E', 'ud', 1),
  ('equipo', 'RECEPTOR MICROFONÍA', 'AKG', 'SR40 FLEXX PRO DIVERSITY', 'ud', 1),
  ('equipo', 'RECEPTOR MICROFONÍA', 'SHURE', 'BLX88 HBE', 'ud', 1),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SENNHEISER', 'EW300 G3', 'ud', 1),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SHURE', 'BG58', 'ud', 1),
  ('equipo', 'RECEPTOR MICRÓFONO', 'SHURE', 'SLX4 L4 (638-662 MHZ)', 'ud', 1),
  ('equipo', 'TRANSMISOR VÍDEO', 'CRESTRON', 'DM-NVX D363', 'ud', 2),
  ('equipo', 'RECEPTOR VÍDEO', 'CRESTRON', 'DM-TRRX-100-STR', 'ud', 2),
  ('equipo', 'ROUTINGSWITCHER', 'KNOX', 'RS16*16HB', 'ud', 1),
  ('equipo', 'SELECTOR CONMUTADOR VGA', 'EXTRON', 'SW2 VGA DA2A', 'ud', 1),
  ('equipo', 'SISTEMA DE DEBATE', 'BEYERDYNAMIC', 'ORBIS CU', 'ud', 1),
  ('equipo', 'SOPORTE', 'VOGELS', 'MRF-1RP4', 'ud', 1),
  ('equipo', 'SOPORTE', 'VOGELS', 'PVA 5070', 'ud', 1),
  ('equipo', 'SOPORTE CÁMARA', 'VOGELS', 'SOUND 3550', 'ud', 1),
  ('equipo', 'SOPORTE DE PANTALLA', 'EDUSTAND', 'EDUMOVE', 'ud', 1),
  ('equipo', 'SOPORTE DE PARED', 'EXTRON', 'UTS 100', 'ud', 1),
  ('equipo', 'SOPORTE PIE', 'VOGELS', 'T1844B', 'ud', 2),
  ('equipo', 'SOPORTE DE PROYECTOR', 'VOGELS', 'PPC 1555', 'ud', 1),
  ('equipo', 'SPLITER', 'PINANSON', 'P740603', 'ud', 1),
  ('equipo', 'SPLITTER PRENSA', 'PINANSON', 'SPP X12', 'ud', 1),
  ('equipo', 'STEREO DOUBLE CASSETTE DECK', 'PIONEER', 'CT-W208R', 'ud', 1),
  ('equipo', 'SUPRESOR FEEDBACK', 'DBX', 'AFS 224', 'ud', 1),
  ('equipo', 'SWITCH', 'NETGEAR', 'GS308PP', 'ud', 1),
  ('equipo', 'SWITCH', 'NETGEAR', 'GSM 4212UX', 'ud', 1),
  ('equipo', 'SWITCH 4X1 (RACK)', 'CRESTRON', 'HD-MD4X1-4K-E', 'ud', 1),
  ('equipo', 'SWITCHER', 'D LINK', 'DGS – 1008 MP', 'ud', 1),
  ('equipo', 'SWITCHER', 'NETGEAR', 'GS305EPP', 'ud', 1),
  ('equipo', 'TARJETA DANTE', 'EXTRON', 'AXI 44 AT', 'ud', 1),
  ('equipo', 'TARJETA SONIDO EXTERNA', 'M-AUDIO', 'BLX1288/MX53', 'ud', 1),
  ('equipo', 'TECLADO', 'LOGITECH', 'K400 PLUS', 'ud', 1),
  ('equipo', 'TECLADO/RATÓN', 'LOGITECH', 'MX 3200 LÁSER', 'ud', 1),
  ('equipo', 'TELÉFONO', 'CISCO IP', 'NP', 'ud', 1),
  ('equipo', 'TELÉFONO IP', 'CISCO', 'CP-7961', 'ud', 1),
  ('equipo', 'TELÉFONO IP', 'CISCO', 'CP-7975G', 'ud', 1),
  ('equipo', 'TÓTEM', 'FONESTAR', 'STS-40106P', 'ud', 1),
  ('equipo', 'TÓTEM', 'INDETERMINADA', 'SINRUEDAS', 'ud', 2),
  ('equipo', 'TÓTEM', 'SERYSTILU', 'HILTON C2P2', 'ud', 1),
  ('equipo', 'TÓTEM CON PANTALLA', 'FONESTAR', 'CONRUEDAS', 'ud', 1),
  ('equipo', 'TÓTEM CON PANTALLA', 'SERI STYLU', 'HILTON C2P2', 'ud', 1),
  ('equipo', 'TÓTEM CON PANTALLA', 'VOGELS', 'PUC 2718S', 'ud', 1),
  ('equipo', 'TÓTEM CON PANTALLA', 'VOGELS', 'PIE SIN RUEDAS', 'ud', 1),
  ('equipo', 'TRANSMISOR DE VÍDEO', 'SENNHEISER', 'BT T100', 'ud', 1),
  ('equipo', 'TRANSMISOR AUDIO', 'EXTRON', 'HAE 100', 'ud', 1),
  ('equipo', 'TÓTEM', 'DIMASA', 'MIF FLEX', 'ud', 2),
  ('equipo', 'TÓTEM', 'NORTHBAYOU', 'AVA1500-60-1P', 'ud', 1),
  ('equipo', 'UNIDAD CONTROL MICROFONÍA', 'BOSCH', 'DCN - CCU LBB 4100/00', 'ud', 1),
  ('equipo', 'UNIDAD CONTROL MICROFONÍA', 'BOSCH', 'DCN-CCUB-2', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'BOARD 55', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'BOARD PRO 55 G2', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'IP CONFERENCE STATION 7937', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'CS-DESKMINI-K9', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'MX 300', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'ROOM 55', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'SPARK ROOM KIT PLUS', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'WEBEX BOARD PRO', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CISCO', 'WEBEX ROOM 70 SINGLE', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'CRESTRON', 'UC-B30-T', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'LOGITECH', 'GRUPO LOGITECH', 'ud', 1),
  ('equipo', 'VIDEOCONFERENCIA', 'YEALINK', 'MEETING BAR A40', 'ud', 1),
  ('equipo', 'VIDEOWALL', 'UNILUMIN', 'SMD 1,5', 'ud', 1),
  ('equipo', 'WEBCAM', 'LOGITECH', 'C 170', 'ud', 1),
  ('equipo', 'WEBCAM', 'LOGITECH', 'HD C920', 'ud', 1),
  ('equipo', 'WEBCAM', 'LOGITECH', 'PRO5000', 'ud', 1),
  ('equipo', 'WEBCAM', 'LOGITECH', 'QUICKCAM PRO 5000', 'ud', 1)
on conflict (coalesce(marca, ''), modelo, categoria) do update set unidades_instaladas = excluded.unidades_instaladas;

-- Catálogo: 30 referencias de cable y consumible (base editable)
insert into articulos (tipo, categoria, marca, modelo, descripcion, unidad, senal, conector_a, conector_b, longitudes_comerciales_m, bobina_m, diametro_mm, coste, plazo_dias, stock_minimo) values
  ('cable', 'CABLE HDMI', null, 'HDMI 2.0 4K60 4:4:4', 'Latiguillo HDMI alta velocidad con Ethernet, hasta 5 m sin repetidor', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[1,2,3,5,7.5,10,15]::numeric[], null, 7.3, null, null, null),
  ('cable', 'CABLE HDMI', null, 'HDMI 2.1 48G', 'Latiguillo HDMI 8K, tiradas cortas de rack a pantalla', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[1,2,3,5]::numeric[], null, 8, null, null, null),
  ('cable', 'CABLE HDMI', null, 'HDMI FIBRA OPTICA ACTIVA', 'Para tiradas largas a proyector o pantalla lejana', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[10,15,20,30,50]::numeric[], null, 4.8, null, null, null),
  ('cable', 'CABLE RED', null, 'CAT6 U/UTP LSZH', 'Cable de red a metros para tomas y equipos', 'm', 'red', null, null, null, 305, 5.5, null, null, null),
  ('cable', 'CABLE RED', null, 'CAT6A F/UTP LSZH', 'Apantallado. Obligatorio para HDBaseT, Extron DTP y Dante', 'm', 'red', null, null, null, 305, 7, null, null, null),
  ('cable', 'CABLE RED', null, 'LATIGUILLO CAT6A F/UTP', 'Latiguillo montado para rack y equipos', 'ud', 'red', 'RJ45', 'RJ45', array[0.5,1,2,3,5,10]::numeric[], null, 7, null, null, null),
  ('cable', 'CABLE USB', null, 'USB-C 3.2 GEN2 100W', 'Conexion de portatil a dock o caja de conexiones', 'ud', 'usb', 'USB-C', 'USB-C', array[1,2,3]::numeric[], null, 5, null, null, null),
  ('cable', 'CABLE USB', null, 'USB-A A USB-B ACTIVO', 'Camaras y barras de videoconferencia a mas de 5 m', 'ud', 'usb', 'USB-A', 'USB-B', array[5,10,15]::numeric[], null, 5.5, null, null, null),
  ('cable', 'CABLE AUDIO', null, 'ALTAVOZ 2X2,5 MM2 LSZH', 'Linea de altavoces de techo y pared', 'm', 'audio_altavoz', null, null, null, 100, 7.5, null, null, null),
  ('cable', 'CABLE AUDIO', null, 'ALTAVOZ 2X1,5 MM2 LSZH', 'Tiradas cortas de altavoz', 'm', 'audio_altavoz', null, null, null, 100, 6.2, null, null, null),
  ('cable', 'CABLE AUDIO', null, 'MICROFONO 2X0,22 APANTALLADO', 'Cable de senal balanceada a metros', 'm', 'microfono', null, null, null, 100, 5, null, null, null),
  ('cable', 'CABLE AUDIO', null, 'LATIGUILLO XLR 3 PINES', 'Microfonia y linea balanceada montada', 'ud', 'microfono', 'XLR M', 'XLR H', array[1,3,5,10,20]::numeric[], null, 6.5, null, null, null),
  ('cable', 'CABLE CONTROL', null, 'RS-232 APANTALLADO', 'Control de proyector y pantalla motorizada', 'm', 'control', null, null, null, 100, 4.5, null, null, null),
  ('cable', 'CABLE ALIMENTACION', null, 'MANGUERA 3X1,5 MM2 LSZH', 'Alimentacion de pantalla, rack y puntos de techo', 'm', 'alimentacion', null, null, null, 100, 9, null, null, null),
  ('cable', 'CABLE ALIMENTACION', null, 'LATIGUILLO SCHUKO-IEC C13', 'Alimentacion de equipo de rack', 'ud', 'alimentacion', 'Schuko', 'IEC C13', array[0.5,1,2,3,5]::numeric[], null, 7, null, null, null),
  ('consumible', 'CONECTOR', null, 'CONECTOR RJ45 CAT6 UTP', 'Conector de campo', 'ud', 'red', null, null, null, null, null, null, null, null),
  ('consumible', 'CONECTOR', null, 'CONECTOR RJ45 CAT6A FTP', 'Conector apantallado de campo', 'ud', 'red', null, null, null, null, null, null, null, null),
  ('consumible', 'CONECTOR', null, 'CONECTOR XLR MACHO', null, 'ud', 'microfono', null, null, null, null, null, null, null, null),
  ('consumible', 'CONECTOR', null, 'CONECTOR XLR HEMBRA', null, 'ud', 'microfono', null, null, null, null, null, null, null, null),
  ('consumible', 'CANALIZACION', null, 'CANALETA 25X16 MM', 'Canaleta blanca con tapa', 'm', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'CANALIZACION', null, 'CANALETA 40X25 MM', 'Canaleta blanca con tapa', 'm', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'CANALIZACION', null, 'CANALETA 60X40 MM', 'Canaleta blanca con tapa', 'm', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'CANALIZACION', null, 'TUBO CORRUGADO 20 MM', 'Tubo flexible libre de halogenos', 'm', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'CANALIZACION', null, 'TUBO CORRUGADO 25 MM', 'Tubo flexible libre de halogenos', 'm', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'FIJACION', null, 'BRIDA NYLON 200 MM', null, 'ud', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'FIJACION', null, 'GRAPA SUJETACABLES', null, 'ud', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'FIJACION', null, 'SOPORTE PANTALLA VESA FIJO 400X400', 'Para pantallas de 55 y 65 pulgadas', 'ud', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'FIJACION', null, 'SOPORTE PANTALLA VESA INCLINABLE 600X400', null, 'ud', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'MECANISMO', null, 'CAJA DE SUPERFICIE 2 MODULOS', null, 'ud', 'otro', null, null, null, null, null, null, null, null),
  ('consumible', 'MECANISMO', null, 'PLACA HDMI + RJ45 EMPOTRABLE', 'Placa de pared para toma de sala', 'ud', 'otro', null, null, null, null, null, null, null, null)
on conflict (coalesce(marca, ''), modelo, categoria) do update set descripcion = excluded.descripcion, longitudes_comerciales_m = excluded.longitudes_comerciales_m, bobina_m = excluded.bobina_m, diametro_mm = excluded.diametro_mm;

-- Precios: 98 líneas de 13 presupuestos, 31 referencias nuevas
insert into proveedores (nombre) values
  ('CISCO SYSTEMS')
on conflict (nombre) do nothing;

insert into articulos (tipo, categoria, marca, modelo, descripcion, unidad, senal, conector_a, conector_b, longitudes_comerciales_m, bobina_m, referencia_fabricante) values
  ('cable', 'CABLE HDMI', 'EXTRON', 'HDMI ULTRA/6', 'Latiguillo HDMI premium alta velocidad ultraflexible 4K, 1,8 m (6 ft)', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[1.8]::numeric[], null, '26-663-06'),
  ('cable', 'CABLE HDMI', 'EXTRON', 'HDMI ULTRA/9', 'Latiguillo HDMI premium alta velocidad ultraflexible 4K, 2,7 m (9 ft)', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[2.7]::numeric[], null, '26-663-09'),
  ('cable', 'CABLE HDMI', 'EXTRON', 'HDMI ULTRA/12', 'Latiguillo HDMI premium alta velocidad ultraflexible 4K, 3,6 m (12 ft)', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[3.6]::numeric[], null, '26-663-12'),
  ('cable', 'CABLE HDMI', 'EXTRON', 'HDMI ULTRA/15', 'Latiguillo HDMI premium alta velocidad ultraflexible 4K, 4,5 m (15 ft)', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[4.5]::numeric[], null, '26-663-15'),
  ('consumible', 'ADAPTADOR', 'NANOCABLE', '10.15.1201', 'Transición HDMI A hembra - A hembra V1.4b 4K', 'ud', 'hdmi', 'HDMI A H', 'HDMI A H', null, null, '10.15.1201'),
  ('cable', 'CABLE AUDIO', 'AUDIBAX', '10116238', 'Multicore 4 XLR macho a 12 XLR hembra, 15 m', 'ud', 'microfono', 'XLR M', 'XLR H', array[15]::numeric[], null, '10116238'),
  ('cable', 'CABLE AUDIO', 'AUDIBAX', 'CAJETÍN ESCENARIO 12/4 15 M', 'Cajetín de escenario 12 entradas 4 salidas, 15 m', 'ud', 'microfono', 'XLR M', 'XLR H', array[15]::numeric[], null, null),
  ('equipo', 'BATERÍA', 'SHURE', 'SB903', 'Batería de iones de litio para SLXD', 'ud', null, null, null, null, null, 'SB903'),
  ('cable', 'CABLE HDMI', 'NANOCABLE', '10.15.3807', 'Latiguillo HDMI 7 m. EAN 8433281013001', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[7]::numeric[], null, '10.15.3807'),
  ('cable', 'CABLE HDMI', 'NANOCABLE', '10.15.8005', 'Latiguillo HDMI 5 m. EAN 8433281014121', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[5]::numeric[], null, '10.15.8005'),
  ('equipo', 'HUB USB', 'D-LINK', 'DUB-H4', 'Hub USB 2.0 de 4 puertos alimentado', 'ud', 'usb', null, null, null, null, 'DUB-H4/E'),
  ('cable', 'CABLE AUDIO', 'GOTHAM', 'GAC-2', 'Cable de audio balanceado 2 conductores, bobina de 100 m', 'm', 'microfono', null, null, null, 100, '10401'),
  ('equipo', 'INTERFAZ DE AUDIO', 'FOCUSRITE', 'SCARLETT 8I6 3RD GEN', 'Interfaz de audio USB', 'ud', 'audio_linea', null, null, null, null, null),
  ('equipo', 'SWITCH POE', 'TP-LINK', 'TL-SG1005P', 'Switch 5 puertos con 4 PoE', 'ud', 'red', null, null, null, null, null),
  ('consumible', 'CONECTOR', 'NEUTRIK', 'NP3 X-B', 'Conector jack 6,3 mm estéreo', 'ud', 'audio_linea', null, null, null, null, null),
  ('equipo', 'SOPORTE DE MICRÓFONO', 'GRAVITY', 'MS 23 XLR B', 'Soporte de micrófono con conector XLR y cuello de cisne', 'ud', null, null, null, null, null, null),
  ('equipo', 'SOPORTE DE MICRÓFONO', 'K&M', '210/8', 'Soporte de micrófono de pie con jirafa', 'ud', null, null, null, null, null, null),
  ('equipo', 'TARJETA DE RED', 'ASUS', 'PCE-AX1800', 'Tarjeta de red PCIe Wi-Fi 6', 'ud', 'red', null, null, null, null, null),
  ('equipo', 'AURICULARES', 'SENNHEISER', 'HD-25', 'Auriculares de monitorado', 'ud', 'audio_linea', null, null, null, null, null),
  ('equipo', 'SOPORTE DE PANTALLA', 'GRIFEMA', 'GB2003-1', 'Soporte de monitor', 'ud', null, null, null, null, null, null),
  ('equipo', 'BANDEJA DE RACK', 'ADAM HALL', '87556', 'Bandeja extraíble enracable 19"', 'ud', null, null, null, null, null, null),
  ('cable', 'CABLE AUDIO', 'CORDIAL', 'CMK 222', 'Cable de micrófono apantallado, bobina de 100 m', 'm', 'microfono', null, null, null, 100, 'CMK 222 BK/100M'),
  ('cable', 'CABLE HDMI', 'KRAMER', 'C-HM/HM-35', 'Latiguillo HDMI de 35 ft (10,7 m)', 'ud', 'hdmi', 'HDMI A', 'HDMI A', array[10.7]::numeric[], null, 'C-HM/HM-35'),
  ('equipo', 'ALTAVOZ', 'MACKIE', 'THUMP 212', 'Altavoz autoamplificado 12"', 'ud', 'audio_altavoz', null, null, null, null, null),
  ('equipo', 'FUNDA DE TRANSPORTE', 'MACKIE', 'BAG THUMP212/XT', 'Funda de transporte para Thump 212', 'ud', null, null, null, null, null, null),
  ('equipo', 'SOPORTE DE ALTAVOZ', 'GRAVITY', 'SS 5211 B', 'Soporte de altavoz con funda, set de 1', 'ud', null, null, null, null, null, null),
  ('equipo', 'MEZCLADOR DE AUDIO', 'YAMAHA', 'MG10 XU', 'Mesa de mezclas 10 canales con USB', 'ud', 'audio_linea', null, null, null, null, null),
  ('cable', 'CABLE AUDIO', 'CORDIAL', 'CTM 20 FM-BK', 'Latiguillo XLR macho-hembra', 'ud', 'microfono', 'XLR M', 'XLR H', array[20]::numeric[], null, 'CTM 20 FM-BK'),
  ('cable', 'CABLE AUDIO', 'CORDIAL', 'CTM 1,5 FM-BK', 'Latiguillo XLR macho-hembra de 1,5 m', 'ud', 'microfono', 'XLR M', 'XLR H', array[1.5]::numeric[], null, 'CTM 1,5 FM-BK'),
  ('equipo', 'RACK', 'TRITON-BLUE', 'FLIGHTCASE COMBINADO 19" 12U', 'Rack combinado 19" 12U, fondo 508 mm', 'ud', null, null, null, null, null, null),
  ('equipo', 'PROYECTOR', 'EPSON', 'EB-1795F', 'Proyector portátil Full HD', 'ud', null, null, null, null, null, null)
on conflict (coalesce(marca, ''), modelo, categoria) do update set descripcion = coalesce(articulos.descripcion, excluded.descripcion), referencia_fabricante = coalesce(articulos.referencia_fabricante, excluded.referencia_fabricante);

-- Los CSV mandan sobre lo suyo. Lo escrito desde la app no se toca.
delete from precios where fuente = 'csv';

insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA cableado Extron', 'final', 'csv', 'EUR', null, '26-663-06', 54.74, 54.74, 1, 10, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/6' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA cableado Extron', 'final', 'csv', 'EUR', null, '26-663-09', 77.89, 77.89, 1, 20, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/9' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA cableado Extron', 'final', 'csv', 'EUR', null, '26-663-12', 88.42, 88.42, 1, 15, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/12' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA cableado Extron', 'final', 'csv', 'EUR', null, '26-663-15', 96.84, 96.84, 1, 10, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/15' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Equipamiento y servicios profesionales', 'final', 'csv', 'EUR', null, '26-663-09', 93, 93, 1, 30, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/9' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Equipamiento y servicios profesionales', 'final', 'csv', 'EUR', null, '26-663-12', 105, 105, 1, 30, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/12' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Equipamiento y servicios profesionales', 'final', 'csv', 'EUR', null, '26-663-15', 115, 115, 1, 20, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/15' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Equipamiento y servicios profesionales', 'final', 'csv', 'EUR', null, '10.15.1201', 7, 7, 1, 40, null
from articulos a where coalesce(marca, '') = 'NANOCABLE' and modelo = '10.15.1201' and categoria = 'ADAPTADOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Equipamiento y servicios profesionales', 'final', 'csv', 'EUR', null, '10116238', 104, 104, 1, 1, null
from articulos a where coalesce(marca, '') = 'AUDIBAX' and modelo = '10116238' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Presupuesto 1', 'final', 'csv', 'EUR', null, '26-663-09', 78.82, 78.82, 1, 30, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/9' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Presupuesto 1', 'final', 'csv', 'EUR', null, '26-663-12', 89.41, 89.41, 1, 30, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/12' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Presupuesto 1', 'final', 'csv', 'EUR', null, '26-663-15', 98.82, 98.82, 1, 20, null
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'HDMI ULTRA/15' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Presupuesto 1', 'final', 'csv', 'EUR', null, '10.15.1201', 9.53, 9.53, 1, 40, null
from articulos a where coalesce(marca, '') = 'NANOCABLE' and modelo = '10.15.1201' and categoria = 'ADAPTADOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Presupuesto 1', 'final', 'csv', 'EUR', null, null, 158.81, 158.81, 1, 1, 'Posible duplicado de AUDIBAX 10116238'
from articulos a where coalesce(marca, '') = 'AUDIBAX' and modelo = 'CAJETÍN ESCENARIO 12/4 15 M' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA switch Netgear', 'final', 'csv', 'EUR', null, 'GS305P-200PES', 68.81, 68.81, 1, 10, 'Referencia del presupuesto con sufijo -200PES'
from articulos a where coalesce(marca, '') = 'NETGEAR' and modelo = 'GS305P' and categoria = 'SWITCH POE'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA material AV pedido enero', 'final', 'csv', 'EUR', null, 'SLXD4DE H56', 675.63, 675.63, 1, 4, 'Referencia del presupuesto SLXD4DE H56'
from articulos a where coalesce(marca, '') = 'SHURE' and modelo = 'SLXD4D' and categoria = 'RECEPTOR MICRÓFONO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA material AV pedido enero', 'final', 'csv', 'EUR', null, 'SLXD2/SM58 H56', 210.46, 210.46, 1, 4, 'Referencia del presupuesto con banda H56'
from articulos a where coalesce(marca, '') = 'SHURE' and modelo = 'SLXD2/SM58' and categoria = 'TRANSMISOR MICROFONÍA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA material AV pedido enero', 'final', 'csv', 'EUR', null, 'SLXD1 H56', 202.01, 202.01, 1, 4, 'Referencia del presupuesto con banda H56'
from articulos a where coalesce(marca, '') = 'SHURE' and modelo = 'SLXD1' and categoria = 'MICRÓFONO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA material AV pedido enero', 'final', 'csv', 'EUR', null, 'WL185MB/C-TQG', 118.4, 118.4, 1, 4, 'Referencia del presupuesto WL185MB/C-TQG'
from articulos a where coalesce(marca, '') = 'SHURE' and modelo = 'WL185' and categoria = 'MICRÓFONO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA material AV pedido enero', 'final', 'csv', 'EUR', null, 'SB903', 43.26, 43.26, 1, 16, null
from articulos a where coalesce(marca, '') = 'SHURE' and modelo = 'SB903' and categoria = 'BATERÍA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA material AV pedido enero', 'final', 'csv', 'EUR', null, 'SBC203-E', 105.72, 105.72, 1, 4, 'Referencia del presupuesto con sufijo -E'
from articulos a where coalesce(marca, '') = 'SHURE' and modelo = 'SBC203' and categoria = 'BASE CARGA MICRÓFONO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA cableado y resto de material', 'final', 'csv', 'EUR', null, '10.15.1201', 14.12, 14.12, 1, 40, null
from articulos a where coalesce(marca, '') = 'NANOCABLE' and modelo = '10.15.1201' and categoria = 'ADAPTADOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA cableado y resto de material', 'final', 'csv', 'EUR', null, '10.15.3807', 12.36, 12.36, 1, 20, null
from articulos a where coalesce(marca, '') = 'NANOCABLE' and modelo = '10.15.3807' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA cableado y resto de material', 'final', 'csv', 'EUR', null, '10.15.8005', 15.53, 15.53, 1, 20, 'Más caro que el de 7 m: comprobar si es otra serie'
from articulos a where coalesce(marca, '') = 'NANOCABLE' and modelo = '10.15.8005' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'BBVA cableado y resto de material', 'final', 'csv', 'EUR', null, 'DUB-H4/E', 29.97, 29.97, 1, 4, null
from articulos a where coalesce(marca, '') = 'D-LINK' and modelo = 'DUB-H4' and categoria = 'HUB USB'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Bobina 100 metros Gotham', 'final', 'csv', 'EUR', null, '10401', 2.109, 210.9, 100, 1, null
from articulos a where coalesce(marca, '') = 'GOTHAM' and modelo = 'GAC-2' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 221.78, 221.78, 1, 1, null
from articulos a where coalesce(marca, '') = 'FOCUSRITE' and modelo = 'SCARLETT 8I6 3RD GEN' and categoria = 'INTERFAZ DE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 37.35, 37.35, 1, 2, null
from articulos a where coalesce(marca, '') = 'TP-LINK' and modelo = 'TL-SG1005P' and categoria = 'SWITCH POE'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 5.11, 5.11, 1, 20, null
from articulos a where coalesce(marca, '') = 'NEUTRIK' and modelo = 'NP3 X-B' and categoria = 'CONECTOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 98.99, 98.99, 1, 1, null
from articulos a where coalesce(marca, '') = 'ELGATO' and modelo = 'CAM LINK 4K' and categoria = 'CAPTURADORA DE VÍDEO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 52.8, 52.8, 1, 2, null
from articulos a where coalesce(marca, '') = 'GRAVITY' and modelo = 'MS 23 XLR B' and categoria = 'SOPORTE DE MICRÓFONO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 48.15, 48.15, 1, 2, null
from articulos a where coalesce(marca, '') = 'K&M' and modelo = '210/8' and categoria = 'SOPORTE DE MICRÓFONO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 30.19, 30.19, 1, 1, null
from articulos a where coalesce(marca, '') = 'ASUS' and modelo = 'PCE-AX1800' and categoria = 'TARJETA DE RED'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 159.3, 159.3, 1, 1, null
from articulos a where coalesce(marca, '') = 'SENNHEISER' and modelo = 'HD-25' and categoria = 'AURICULARES'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 19.54, 19.54, 1, 1, null
from articulos a where coalesce(marca, '') = 'GRIFEMA' and modelo = 'GB2003-1' and categoria = 'SOPORTE DE PANTALLA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 58.78, 58.78, 1, 1, null
from articulos a where coalesce(marca, '') = 'ADAM HALL' and modelo = '87556' and categoria = 'BANDEJA DE RACK'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, null, 575.7, 575.7, 1, 1, null
from articulos a where coalesce(marca, '') = 'SHURE' and modelo = 'BLX1288/W85 COMBO S8' and categoria = 'MICROFONÍA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, 'CMK 222 BK/100M', 0.8363, 83.63, 100, 1, null
from articulos a where coalesce(marca, '') = 'CORDIAL' and modelo = 'CMK 222' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Madrid', 'final', 'csv', 'EUR', null, 'C-HM/HM-35', 30.65, 30.65, 1, 2, 'El presupuesto lo describe como 10 m: la referencia -35 son 35 ft'
from articulos a where coalesce(marca, '') = 'KRAMER' and modelo = 'C-HM/HM-35' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, null, 322.89, 322.89, 1, 2, null
from articulos a where coalesce(marca, '') = 'MACKIE' and modelo = 'THUMP 212' and categoria = 'ALTAVOZ'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, null, 55.94, 55.94, 1, 2, null
from articulos a where coalesce(marca, '') = 'MACKIE' and modelo = 'BAG THUMP212/XT' and categoria = 'FUNDA DE TRANSPORTE'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, null, 100.08, 100.08, 1, 1, null
from articulos a where coalesce(marca, '') = 'GRAVITY' and modelo = 'SS 5211 B' and categoria = 'SOPORTE DE ALTAVOZ'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, null, 246.16, 246.16, 1, 1, null
from articulos a where coalesce(marca, '') = 'YAMAHA' and modelo = 'MG10 XU' and categoria = 'MEZCLADOR DE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, 'CTM 20 FM-BK', 25.1, 25.1, 1, 2, 'El presupuesto lo describe como 15 m: la referencia CTM 20 son 20 m'
from articulos a where coalesce(marca, '') = 'CORDIAL' and modelo = 'CTM 20 FM-BK' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, 'CTM 1,5 FM-BK', 31.14, 31.14, 1, 2, 'Sale más caro que el de 20 m: comprobar'
from articulos a where coalesce(marca, '') = 'CORDIAL' and modelo = 'CTM 1,5 FM-BK' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, null, 292.47, 292.47, 1, 1, null
from articulos a where coalesce(marca, '') = 'TRITON-BLUE' and modelo = 'FLIGHTCASE COMBINADO 19" 12U' and categoria = 'RACK'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, null, 575.7, 575.7, 1, 1, null
from articulos a where coalesce(marca, '') = 'SHURE' and modelo = 'BLX1288/W85 COMBO S8' and categoria = 'MICROFONÍA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · unidad móvil Noroeste', 'final', 'csv', 'EUR', null, null, 913.98, 913.98, 1, 1, null
from articulos a where coalesce(marca, '') = 'EPSON' and modelo = 'EB-1795F' and categoria = 'PROYECTOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Videowall Castellón · suministro Ciudad BBVA', 'final', 'csv', 'EUR', null, '70BFL2214/12', 618.28, 618.28, 1, 20, null
from articulos a where coalesce(marca, '') = 'PHILIPS' and modelo = '70BFL2214/12' and categoria = 'PANTALLA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 1055, 1055, 1, null, 'Rango 1.055-2.265 USD. Table 1.055, Wall 1.195 CSRP'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'ROOM NAVIGATOR' and categoria = 'PANEL TÁCTIL'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 1099, 1099, 1, null, 'Precio de lista. Varios distribuidores piden contactar para precio final'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, 'CS-MIC-TABLE-J', 597, 597, 1, null, 'Rango 597-653 USD. Oferta puntual 355, GPL 808'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'TABLE MICROPHONE MINI JACK (V1)' and categoria = 'MICRÓFONO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 13371, 13371, 1, null, 'Rango enorme 13.371-24.485 USD. Room Kit estándar 13.371, Plus 23.680-24.485 GPL'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 585, 585, 1, null, 'Rango 585-874 según modelo y tamaño. Las cifras altas venían en euros'
from articulos a where coalesce(marca, '') = 'BACHMANN' and modelo = 'TOPFRAME' and categoria = 'CAJA DE CONEXIONES'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 8295, 8295, 1, null, 'CSRP oficial 8.295. Con Navigator incluido 16.207-21.390'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 730, 730, 1, null, 'Rango 730-1.292 USD. El bajo es eBay nuevo, el alto precio de lista'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 4275, 4275, 1, null, 'Lista oficial 204 de Steelcase'
from articulos a where coalesce(marca, '') = 'STEELCASE' and modelo = 'ROOMWIZARD II' and categoria = 'PANTALLA ROOMWIZARD'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 539, 539, 1, null, 'Rango 539-845 USD entre tres distribuidores'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 166, 166, 1, null, 'Rango 166-343 USD. El bajo es el mejor precio nuevo localizado'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · equipos', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 8995, 8995, 1, null, 'CSRP oficial 8.995. Recambio 16.238, en bundle 24.036'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'QUAD CAMERA' and categoria = 'CÁMARA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.45, 0.45, 1, null, 'Rango 0,45-0,80 USD/m. Bobina 305 m entre 140 y 250 USD. La fuente dice F/UTP y el catálogo es U/UTP'
from articulos a where coalesce(marca, '') = '' and modelo = 'CAT6 U/UTP LSZH' and categoria = 'CABLE RED'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 1.4, 1.4, 1, null, 'Rango 1,40-2,80 USD/m. Bobina 305 m entre 425 y 560 USD'
from articulos a where coalesce(marca, '') = '' and modelo = 'CAT6A F/UTP LSZH' and categoria = 'CABLE RED'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 4, 4, 1, null, 'Rango 4-15 USD por latiguillo según longitud comercial'
from articulos a where coalesce(marca, '') = '' and modelo = 'HDMI 2.0 4K60 4:4:4' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 9, 9, 1, null, 'Rango 9-52 USD. Certificado Ultra High Speed'
from articulos a where coalesce(marca, '') = '' and modelo = 'HDMI 2.1 48G' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 62, 62, 1, null, 'Rango 62-125 USD en longitudes de 15 a 50 m'
from articulos a where coalesce(marca, '') = '' and modelo = 'HDMI FIBRA OPTICA ACTIVA' and categoria = 'CABLE HDMI'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 6, 6, 1, null, 'Rango 6-25 USD. Genérico 6-11, UGREEN 13-25'
from articulos a where coalesce(marca, '') = '' and modelo = 'USB-C 3.2 GEN2 100W' and categoria = 'CABLE USB'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 22, 22, 1, null, 'Rango 22-120 USD. Estándar 22, plenum 103-120'
from articulos a where coalesce(marca, '') = '' and modelo = 'USB-A A USB-B ACTIVO' and categoria = 'CABLE USB'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 4, 4, 1, null, 'Rango 4-7 USD/m. Belden 4,16 EUR/m, Tasker 6,71 USD/m, Supra 6 EUR/m'
from articulos a where coalesce(marca, '') = '' and modelo = 'ALTAVOZ 2X2,5 MM2 LSZH' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 2.5, 2.5, 1, null, 'Rango 2,50-4,50 USD/m. Estimado 30-40 % menos que el 2x2,5, no medido'
from articulos a where coalesce(marca, '') = '' and modelo = 'ALTAVOZ 2X1,5 MM2 LSZH' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 15, 15, 1, null, 'Rango 15-50 USD en latiguillos de 1 a 3 m'
from articulos a where coalesce(marca, '') = '' and modelo = 'LATIGUILLO XLR 3 PINES' and categoria = 'CABLE AUDIO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 1.5, 1.5, 1, null, 'Rango 1,50-4 USD/m a granel. Latiguillos terminados desde 6 USD'
from articulos a where coalesce(marca, '') = '' and modelo = 'RS-232 APANTALLADO' and categoria = 'CABLE CONTROL'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.5, 0.5, 1, null, 'Rango 0,50-0,80 USD/m. H05VV-F o similar, 560 USD los 1.000 m'
from articulos a where coalesce(marca, '') = '' and modelo = 'MANGUERA 3X1,5 MM2 LSZH' and categoria = 'CABLE ALIMENTACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 4, 4, 1, null, 'Rango 4-9 USD en 1,5 a 2,5 m'
from articulos a where coalesce(marca, '') = '' and modelo = 'LATIGUILLO SCHUKO-IEC C13' and categoria = 'CABLE ALIMENTACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.8, 0.8, 1, null, 'Rango 0,80-2 USD/m. Muy variable por región'
from articulos a where coalesce(marca, '') = '' and modelo = 'CANALETA 25X16 MM' and categoria = 'CANALIZACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 1.5, 1.5, 1, null, 'Rango 1,50-3,50 USD/m. Estimado sobre la base del 25x16, no medido'
from articulos a where coalesce(marca, '') = '' and modelo = 'CANALETA 40X25 MM' and categoria = 'CANALIZACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 2.5, 2.5, 1, null, 'Rango 2,50-5 USD/m. Estimado, consultar distribuidor local por volumen'
from articulos a where coalesce(marca, '') = '' and modelo = 'CANALETA 60X40 MM' and categoria = 'CANALIZACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.3, 0.3, 1, null, 'Rango 0,30-0,80 USD/m. Rollo de 25-50 m entre 15 y 25 USD'
from articulos a where coalesce(marca, '') = '' and modelo = 'TUBO CORRUGADO 20 MM' and categoria = 'CANALIZACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.7, 0.7, 1, null, 'Rango 0,70-1,80 USD/m. Rollo de 10-25 m entre 18 y 35 USD'
from articulos a where coalesce(marca, '') = '' and modelo = 'TUBO CORRUGADO 25 MM' and categoria = 'CANALIZACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.25, 0.25, 1, null, 'Rango 0,25-0,60 USD. Pack de 50-100 uds entre 0,25 y 0,45'
from articulos a where coalesce(marca, '') = '' and modelo = 'CONECTOR RJ45 CAT6 UTP' and categoria = 'CONECTOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.45, 0.45, 1, null, 'Rango 0,45-0,60 USD apantallado, pack de 50-100 uds'
from articulos a where coalesce(marca, '') = '' and modelo = 'CONECTOR RJ45 CAT6A FTP' and categoria = 'CONECTOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 2, 2, 1, null, 'Rango 2-10 USD. Metal estándar 2-5, chasis 3. La fuente no separa macho y hembra'
from articulos a where coalesce(marca, '') = '' and modelo = 'CONECTOR XLR MACHO' and categoria = 'CONECTOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 2, 2, 1, null, 'Rango 2-10 USD. Metal estándar 2-5, chasis 3. La fuente no separa macho y hembra'
from articulos a where coalesce(marca, '') = '' and modelo = 'CONECTOR XLR HEMBRA' and categoria = 'CONECTOR'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.01, 1, 100, null, 'Pack de 100 uds entre 1 y 6 USD. Cargado como el pack más barato'
from articulos a where coalesce(marca, '') = '' and modelo = 'BRIDA NYLON 200 MM' and categoria = 'FIJACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 0.15, 0.15, 1, null, 'Rango 0,15-0,50 USD por unidad. Packs de 20-50 uds entre 4 y 12 USD'
from articulos a where coalesce(marca, '') = '' and modelo = 'GRAPA SUJETACABLES' and categoria = 'FIJACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 17, 17, 1, null, 'Rango 17-120 USD. Fijo básico 17-37, articulado 60-120'
from articulos a where coalesce(marca, '') = '' and modelo = 'SOPORTE PANTALLA VESA FIJO 400X400' and categoria = 'FIJACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 40, 40, 1, null, 'Rango 40-240 USD. Fijo 40-90, full-motion profesional 240-500'
from articulos a where coalesce(marca, '') = '' and modelo = 'SOPORTE PANTALLA VESA INCLINABLE 600X400' and categoria = 'FIJACION'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 1.65, 1.65, 1, null, 'Rango 1,65-4 USD. Plástico estándar 1,65-3,23, resistente al fuego 4'
from articulos a where coalesce(marca, '') = '' and modelo = 'CAJA DE SUPERFICIE 2 MODULOS' and categoria = 'MECANISMO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, null, 'Referencia web · cable', 'orientativo', 'csv', 'USD', '2026-08-05'::date, null, 8, 8, 1, null, 'Rango 8-20 USD con keystone jacks'
from articulos a where coalesce(marca, '') = '' and modelo = 'PLACA HDMI + RJ45 EMPOTRABLE' and categoria = 'MECANISMO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-KITPRO-K9', 11641.33, 11641.33, 1, 1, 'Linea 3.0. Unit Net Price. Estimacion no vinculante en USD de marzo de 2024'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'ROOM KIT PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-KITPLUS-K9', 7671.07, 7671.07, 1, 1, 'Linea 8.0. El catalogo tiene ademas SPARK ROOM KIT PLUS, que puede ser el mismo producto con la marca antigua: no se le cuelga el precio'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'ROOM KIT PLUS' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-KIT-K9', 4330.07, 4330.07, 1, 1, 'Linea 10.0. El catalogo guarda este articulo con el propio part number como modelo'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'CS-KIT-K9' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-KIT-MINI-K9', 2179.92, 2179.92, 1, 1, 'Linea 11.0. Unico Room Kit Mini del catalogo, escrito con las palabras en otro orden'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'MINI SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-BRD55P-K9', 8696.52, 8696.52, 1, 1, 'Linea 17.0. Primera generacion. BOARD PRO 55 G2 es la segunda y tiene otro part number: no se le cuelga el precio'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX BOARD PRO 55' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-DESK-K9', 1816.05, 1816.05, 1, 1, 'Linea 19.0. El catalogo guarda este articulo con el propio part number como modelo'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'CS-DESK-K9' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-DESKMINI-K9', 1220.62, 1220.62, 1, 1, 'Linea 20.0. El catalogo guarda este articulo con el propio part number como modelo'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'CS-DESKMINI-K9' and categoria = 'VIDEOCONFERENCIA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CTS-CAM-P60=', 3465.15, 3465.15, 1, 1, 'Linea 21.0. Recambio. P60 y PRECISION 60 son probablemente la misma camara escrita de otra forma y no se les cuelga el precio'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'CTS-CAM-P60' and categoria = 'CÁMARA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-CAM-PTZ4K=', 3465.15, 3465.15, 1, 1, 'Linea 22.0. Recambio'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'PTZ 4K' and categoria = 'CÁMARA'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';
insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)
select a.id, (select id from proveedores where nombre = 'CISCO SYSTEMS'), 'Cisco QA152721337VJ', 'orientativo', 'csv', 'USD', '2024-03-04'::date, 'CS-MIC-TABLE-J', 215.01, 215.01, 1, 1, 'Lineas 5.3, 8.2 y 9.3, las tres al mismo precio. El part number ya estaba colgado de la V1 en precios-orientativos.csv. La V2 se queda sin precio'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'TABLE MICROPHONE MINI JACK (V1)' and categoria = 'MICRÓFONO'
on conflict (presupuesto, articulo_id) do update set origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, notas = excluded.notas
where precios.fuente = 'csv';

-- Coste del catálogo: la mejor oferta vigente; si no hay, la mejor referencia
with cambio as (
  select coalesce(max(valor), 1) as usd_eur
  from parametros where clave = 'tipo_cambio_usd_eur'
),
vigencia as (
  select coalesce(max(valor), 18)::int as meses
  from parametros where clave = 'vigencia_precio_meses'
),
en_euros as (
  select p.articulo_id, p.origen,
         p.precio * case when p.moneda = 'EUR' then 1 else c.usd_eur end as precio_eur
  from precios p, cambio c, vigencia v
  where p.fecha is null
     or p.fecha >= current_date - make_interval(months => v.meses)
),
mejor as (
  select articulo_id,
         min(precio_eur) filter (where origen = 'final')       as final,
         min(precio_eur) filter (where origen = 'orientativo')  as orientativo
  from en_euros group by articulo_id
)
update articulos a
set coste = round(coalesce(m.final, m.orientativo), 4),
    coste_orientativo = (m.final is null)
from mejor m
where m.articulo_id = a.id
  and coalesce(m.final, m.orientativo) is not null;

-- Referencia del fabricante: la del presupuesto más reciente que la traiga
update articulos a
set referencia_fabricante = c.referencia
from (
  select distinct on (articulo_id) articulo_id, referencia
  from precios where referencia is not null
  order by articulo_id, fecha desc nulls last
) c
where c.articulo_id = a.id and a.referencia_fabricante is null;

-- Puertos: 124 de 22 artículos (data/puertos.csv)
-- El CSV manda sobre lo suyo. Lo escrito desde la app no se toca.
delete from puertos where fuente = 'csv';

insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'NETWORK', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 1, 'Un solo cable para red y alimentación. Se alimenta por PoE. Emparejamiento directo a un puerto PoE del codec o remoto por LAN. Cat5e o Cat6 hasta 100 m', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'ROOM NAVIGATOR' and categoria = 'PANEL TÁCTIL'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'MICRO USB', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'Micro-USB', 2, 'Depuración y servicio. No se cablea en la instalación', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'ROOM NAVIGATOR' and categoria = 'PANEL TÁCTIL'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'NETWORK', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 1, 'Un solo cable para red y alimentación PoE 802.3af. Emparejamiento directo al codec o por LAN con inyector PoE intermedio. El inyector debe estar en el mismo edificio', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'TOUCH 10' and categoria = 'PANEL TÁCTIL'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'Presentación. Hasta 3840x2160 a 30 fps. CEC 2.0', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI OUT 1', 1, 'salida'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'Pantalla principal. Hasta 3840x2160 a 60 fps', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI OUT 2', 1, 'salida'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 3, 'Segunda pantalla. Hasta 3840x2160 a 60 fps', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'MIC IN', 2, 'entrada'::sentido_puerto, 'microfono'::senal, 'Jack 3.5', 4, 'Dos entradas de micrófono en mini jack de 4 pines. Aquí van los Cisco Table Microphone', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'LINE OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 5, 'Mini jack estéreo. Preparado para subwoofer o bucle de inducción', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'LAN', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 6, 'Ethernet 10/100/1000 a la red del edificio', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'TOUCH', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 7, 'Ethernet dedicada al emparejamiento directo del Touch 10 o del Room Navigator. Da PoE al panel', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 8, 'USB 2.0. La ficha dice USB 2.0 pero no el tipo de conector. USB-A sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER IN', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 9, 'Fuente externa de 100-240 V CA con salida de 12 V CC al equipo. Tipo de conector del equipo sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'SPARK ROOM KIT' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'Presentación. Hasta 3840x2160 a 30 fps. CEC 2.0', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI OUT', 3, 'salida'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'Tres salidas hasta 3840x2160 a 60 fps. Admiten pantalla táctil usando además un USB-A para el retorno del táctil', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB-C', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-C', 3, 'Entrada de vídeo y audio y passthrough de cámara micrófono y altavoces con un solo cable para BYOD. Requiere DisplayPort alt mode en el portátil', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'LAN', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 4, 'Ethernet 10/100/1000 a la red del edificio', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'PoE NAVIGATOR', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 5, 'Ethernet PoE 802.3af con presupuesto de 15,4 W para el emparejamiento directo del Room Navigator', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'PoE AV', 2, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 6, 'Dos puertos PoE 802.3af de 15,4 W cada uno para micrófonos IP y equipo de audio AES67. Más de tres micrófonos IP exigen licencia AV Integrator', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'MIC IN', 2, 'entrada'::sentido_puerto, 'microfono'::senal, 'Jack 3.5', 7, 'Dos entradas analógicas de micrófono. La ficha no da el conector. Mini jack de 4 pines sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'LINE OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 8, 'Una salida de línea analógica. La ficha no da el conector. Sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB-A', 2, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 9, 'USB 2.0 para pantalla táctil micrófonos teclados y periféricos de sala', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'MICRO USB', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'Micro-USB', 10, 'Puerto de servicio. No se cablea en la instalación', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER IN', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 11, '100-240 V CA a 50/60 Hz con cable de red específico por país. Media de 20 W. Tipo de conector sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'WEBEX ROOM BAR PRO' and categoria = 'VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'SALIDA DE MICRÓFONO', 1, 'salida'::sentido_puerto, 'microfono'::senal, 'Jack 3.5', 1, 'Cable fijo de 7,5 m terminado en mini jack macho de 4 pines. Extensión CAB-MIC-EXT-J de 9 m. No lleva alimentación propia. Se alimenta del codec', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'TABLE MICROPHONE MINI JACK (V1)' and categoria = 'MICRÓFONO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'SALIDA DE MICRÓFONO', 1, 'salida'::sentido_puerto, 'microfono'::senal, 'Jack 3.5', 1, 'Mismo conector que la V1. Longitud exacta del cable de la V2 sin confirmar en ficha técnica. No lleva alimentación propia', 'csv'
from articulos a where coalesce(marca, '') = 'CISCO' and modelo = 'TABLE MICROPHONE MINI JACK (V2)' and categoria = 'MICRÓFONO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 1', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'HDMI 2.0 con ARC y HDCP 2.2. Entrada principal', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 2', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'HDMI 2.0. Segunda fuente', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DVI IN', 1, 'entrada'::sentido_puerto, 'otro'::senal, 'DVI-D', 3, 'DVI-D. Admite fuente HDMI con cable HDMI-DVI. El audio de esta entrada va por DVI/HDMI AUDIO IN', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DVI/HDMI AUDIO IN', 1, 'entrada'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 4, 'Mini jack estéreo. Audio analógico de la fuente DVI', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 5, 'Mini jack estéreo a sistema de audio externo', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RJ45', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 6, 'Red y control MDC a 10/100 Mbps. Samsung recomienda Cat7 apantallado', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RS232C IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 7, 'Control MDC con adaptador RS232C. Es un jack estéreo pero no lleva audio. La ficha de serie menciona además RS232C OUT pero no está confirmado en este tamaño', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB 1', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 8, 'USB 2.0 hasta 1,0 A. Reproducción local desde memoria USB', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB 2', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 9, 'USB 2.0 hasta 0,5 A', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'IR IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 10, 'Cable receptor de infrarrojos externo. Tipo de conector sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER IN', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 11, '100-240 V CA a 50/60 Hz con cable desmontable. 128 W típicos. Tipo de conector IEC sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 1', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'HDMI 2.0 con ARC y HDCP 2.2. Entrada principal', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 2', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'HDMI 2.0. Segunda fuente', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DVI IN', 1, 'entrada'::sentido_puerto, 'otro'::senal, 'DVI-D', 3, 'DVI-D. Admite fuente HDMI con cable HDMI-DVI. El audio de esta entrada va por DVI/HDMI AUDIO IN', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DVI/HDMI AUDIO IN', 1, 'entrada'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 4, 'Mini jack estéreo. Audio analógico de la fuente DVI', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 5, 'Mini jack estéreo a sistema de audio externo', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RJ45', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 6, 'Red y control MDC a 10/100 Mbps. Samsung recomienda Cat7 apantallado', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RS232C IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 7, 'Control MDC con adaptador RS232C. Es un jack estéreo pero no lleva audio', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB 1', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 8, 'USB 2.0 hasta 1,0 A. Reproducción local desde memoria USB', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB 2', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 9, 'USB 2.0 hasta 0,5 A', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'IR IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 10, 'Cable receptor de infrarrojos externo. Tipo de conector sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER IN', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 11, '100-240 V CA a 50/60 Hz con cable desmontable. Tipo de conector IEC sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB65R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 1', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'HDMI 2.0 con ARC y HDCP 2.2. Entrada principal', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 2', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'HDMI 2.0. Segunda fuente', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DVI IN', 1, 'entrada'::sentido_puerto, 'otro'::senal, 'DVI-D', 3, 'DVI-D. Admite fuente HDMI con cable HDMI-DVI. El audio de esta entrada va por DVI/HDMI AUDIO IN', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DVI/HDMI AUDIO IN', 1, 'entrada'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 4, 'Mini jack estéreo. Audio analógico de la fuente DVI', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 5, 'Mini jack estéreo a sistema de audio externo', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RJ45', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 6, 'Red y control MDC a 10/100 Mbps. Samsung recomienda Cat7 apantallado', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RS232C IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 7, 'Control MDC con adaptador RS232C. Es un jack estéreo pero no lleva audio', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB 1', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 8, 'USB 2.0 hasta 1,0 A. Reproducción local desde memoria USB', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB 2', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 9, 'USB 2.0 hasta 0,5 A', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'IR IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 10, 'Cable receptor de infrarrojos externo. Tipo de conector sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER IN', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 11, '100-240 V CA a 50/60 Hz con cable desmontable. 108 W típicos. Tipo de conector IEC sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 1', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'HDMI 2.0 con ARC y HDCP 2.2. Entrada principal', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 2', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'HDMI 2.0. Segunda fuente', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DVI IN', 1, 'entrada'::sentido_puerto, 'otro'::senal, 'DVI-D', 3, 'DVI-D. Admite fuente HDMI con cable HDMI-DVI. El audio de esta entrada va por DVI/HDMI AUDIO IN', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DVI/HDMI AUDIO IN', 1, 'entrada'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 4, 'Mini jack estéreo. Audio analógico de la fuente DVI', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 5, 'Mini jack estéreo a sistema de audio externo', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RJ45', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 6, 'Red y control MDC a 10/100 Mbps. Samsung recomienda Cat7 apantallado', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RS232C IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 7, 'Control MDC con adaptador RS232C. Es un jack estéreo pero no lleva audio', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB 1', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 8, 'USB 2.0 hasta 1,0 A. Reproducción local desde memoria USB', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB 2', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 9, 'USB 2.0 hasta 0,5 A', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'IR IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 10, 'Cable receptor de infrarrojos externo. Tipo de conector sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER IN', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 11, '100-240 V CA a 50/60 Hz con cable desmontable. Tipo de conector IEC sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QB55R' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 1', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'HDMI 2.0 con ARC y HDCP 2.2. Entrada principal', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN 2', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'HDMI 2.0. También hace de entrada de daisy chain', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DP IN', 1, 'entrada'::sentido_puerto, 'otro'::senal, 'DisplayPort', 3, 'DisplayPort 1.2. Entrada de daisy chain. Este modelo no tiene DVI', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO IN', 1, 'entrada'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 4, 'Mini jack estéreo común para HDMI y audio', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 5, 'Mini jack estéreo a sistema de audio externo', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RJ45', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 6, 'Red y control MDC a 10/100 Mbps. Samsung recomienda Cat7 apantallado', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RS232C IN', 1, 'entrada'::sentido_puerto, 'control'::senal, 'Jack 3.5', 7, 'Control MDC con adaptador RS232C. Es un jack estéreo pero no lleva audio', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB', 2, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 8, 'Dos puertos USB 2.0. Corriente máxima constante de 1,0 A', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER IN', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 9, '100-240 V CA a 50/60 Hz. 44 W típicos. Tipo de conector IEC sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'SAMSUNG' and modelo = 'QM32R-B' and categoria = 'PANTALLA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'PC', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-B', 1, 'USB 3.0. Pasa cámara micrófono y altavoz por un solo cable. Cable A-B de 1,83 m incluido', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'UC-SB1-CAM' and categoria = 'CÁMARA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO IN', 1, 'entrada'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 2, 'Estéreo no balanceada TRS de 3,5 mm. Entra directa al amplificador sin control de volumen ni proceso', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'UC-SB1-CAM' and categoria = 'CÁMARA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 3, 'Nivel de línea para sistema de ayuda a la audición. Misma señal que los altavoces de la barra', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'UC-SB1-CAM' and categoria = 'CÁMARA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, '24V 2.5A', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 4, 'Alimentador externo de 24 V CC y 2,5 A con cable de red de 1,78 m. Tipo de conector del equipo sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'UC-SB1-CAM' and categoria = 'CÁMARA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI INPUT', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'HDMI tipo A hembra con HDCP 2.2 EDID y CEC', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-E30' and categoria = 'TRANSMISOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'LAN', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 2, '100BASE-TX o 1000BASE-T. Se puede alimentar por PoE+. Mínimo Cat5e y red no bloqueante. No conectar a puertos DM de otros equipos Crestron', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-E30' and categoria = 'TRANSMISOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'PHX-5P', 3, 'Salida de línea estéreo balanceada o no balanceada. Bloque de tornillo desmontable de 5 pines y 3,5 mm. Solo funciona con señal de entrada estéreo de 2 canales', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-E30' and categoria = 'TRANSMISOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'COM', 1, 'bidireccional'::sentido_puerto, 'control'::senal, 'PHX-5P', 4, 'RS-232 bidireccional hasta 115,2 kbaudios con control de flujo', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-E30' and categoria = 'TRANSMISOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'IR 1-2', 1, 'salida'::sentido_puerto, 'control'::senal, 'PHX-4P', 5, 'Bloque de tornillo de 4 pines con dos puertos IR o serie TTL', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-E30' and categoria = 'TRANSMISOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'CONSOLE', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'Micro-USB', 6, 'Consola USB 2.0 para configuración. No se cablea en la instalación', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-E30' and categoria = 'TRANSMISOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, '24VDC', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, 'Jack DC 5.5', 7, 'Entrada de 24 V CC con conector de 2,1 x 5,5 mm. Alternativa a alimentar por PoE+', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-E30' and categoria = 'TRANSMISOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI OUTPUT', 1, 'salida'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'HDMI tipo A hembra', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-D30' and categoria = 'RECEPTOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'LAN', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 2, '100BASE-TX o 1000BASE-T. Se puede alimentar por PoE+. Mínimo Cat5e y red no bloqueante. No conectar a puertos DM de otros equipos Crestron', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-D30' and categoria = 'RECEPTOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'PHX-5P', 3, 'Salida de línea estéreo balanceada o no balanceada. Bloque de tornillo desmontable de 5 pines y 3,5 mm', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-D30' and categoria = 'RECEPTOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'COM', 1, 'bidireccional'::sentido_puerto, 'control'::senal, 'PHX-5P', 4, 'RS-232 bidireccional', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-D30' and categoria = 'RECEPTOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'IR 1-2', 1, 'salida'::sentido_puerto, 'control'::senal, 'PHX-4P', 5, 'Bloque de tornillo de 4 pines con dos puertos IR o serie TTL', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-D30' and categoria = 'RECEPTOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'CONSOLE', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'Micro-USB', 6, 'Consola USB 2.0 para configuración. No se cablea en la instalación', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-D30' and categoria = 'RECEPTOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, '24VDC', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, 'Jack DC 5.5', 7, 'Entrada de 24 V CC y 1,25 A con conector de 2,1 x 5,5 mm. Alternativa a alimentar por PoE+', 'csv'
from articulos a where coalesce(marca, '') = 'CRESTRON' and modelo = 'DM-NVX-D30' and categoria = 'RECEPTOR DE VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI IN', 1, 'entrada'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'HDMI tipo A hembra. Lleva bridas LockIt para fijar el conector', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 TX' and categoria = 'TRANSMISOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO IN', 1, 'entrada'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 2, 'Mini jack estéreo de 3,5 mm no balanceado. El audio analógico viaja por el par trenzado sin embeberse en el vídeo', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 TX' and categoria = 'TRANSMISOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RS-232 IR', 1, 'bidireccional'::sentido_puerto, 'control'::senal, 'PHX-5P', 3, 'Bloque de tornillo con masa RS-232 Tx y Rx e IR Tx y Rx. Se conecta el equipo principal al Tx y el secundario al Rx', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 TX' and categoria = 'TRANSMISOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DTP OUT', 1, 'salida'::sentido_puerto, 'otro'::senal, 'RJ45', 4, 'Enlace de par trenzado al receptor hasta 70 m. Cat6A apantallado de 24 AWG rígido terminado en T568B. NO conectar a la red de datos', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 TX' and categoria = 'TRANSMISOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, 'PHX-2P', 5, '12 V CC por bloque de tornillo. Fuente externa con cable IEC a 100-240 V CA. Una sola fuente alimenta la pareja Tx y Rx a través del cable DTP', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 TX' and categoria = 'TRANSMISOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DTP IN', 1, 'entrada'::sentido_puerto, 'otro'::senal, 'RJ45', 1, 'Enlace de par trenzado desde el transmisor hasta 70 m. Cat6A apantallado de 24 AWG rígido. NO conectar a la red de datos', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 RX' and categoria = 'RECEPTOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI OUT', 1, 'salida'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'HDMI tipo A hembra a la pantalla. Lleva bridas LockIt para fijar el conector', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 RX' and categoria = 'RECEPTOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO OUT', 1, 'salida'::sentido_puerto, 'audio_linea'::senal, 'PHX-5P', 3, 'Bloque de tornillo. Admite salida estéreo balanceada o no balanceada y mono', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 RX' and categoria = 'RECEPTOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RS-232 IR', 1, 'bidireccional'::sentido_puerto, 'control'::senal, 'PHX-5P', 4, 'Bloque de tornillo con masa RS-232 Tx y Rx e IR Tx y Rx', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 RX' and categoria = 'RECEPTOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'POWER', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, 'PHX-2P', 5, '12 V CC por bloque de tornillo. Puede alimentarse en remoto desde el Tx por el cable DTP y entonces no necesita fuente local', 'csv'
from articulos a where coalesce(marca, '') = 'EXTRON' and modelo = 'DTP HDMI 4K 230 RX' and categoria = 'RECEPTOR VÍDEO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI OUT', 1, 'salida'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 1, 'Salida a pantalla por DisplayLink con adaptador USB a HDMI integrado a 1080p. Ficha del VB342+. El inventario no distingue VB342 de VB342+', 'csv'
from articulos a where coalesce(marca, '') = 'AVER' and modelo = 'VB342' and categoria = 'BARRA DE VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-C', 2, 'USB 3.1 Gen 1 al PC. Cable USB-C a USB-A de 1,8 m incluido. Ficha del VB342+. Sin confirmar para el VB342 base', 'csv'
from articulos a where coalesce(marca, '') = 'AVER' and modelo = 'VB342' and categoria = 'BARRA DE VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'PHONE IN', 1, 'entrada'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 3, 'Line-in de 3,5 mm para usar la barra como manos libres de un móvil o un PC. Ficha del VB342+', 'csv'
from articulos a where coalesce(marca, '') = 'AVER' and modelo = 'VB342' and categoria = 'BARRA DE VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'MICROPHONE', 1, 'entrada'::sentido_puerto, 'microfono'::senal, 'Jack 3.5', 4, 'Entrada para micrófono de extensión de 10 m o 20 m. Tipo de conector sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'AVER' and modelo = 'VB342' and categoria = 'BARRA DE VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RS232', 1, 'bidireccional'::sentido_puerto, 'control'::senal, 'Mini DIN 6', 5, 'Control VISCA o Pelco P o Pelco D. Necesita adaptador Mini DIN6 a RS-232 opcional. Ficha del VB342+', 'csv'
from articulos a where coalesce(marca, '') = 'AVER' and modelo = 'VB342' and categoria = 'BARRA DE VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DC 12V', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 6, 'Alimentador externo de 12 V y 5 A con cable de 3 m. Tipo de conector sin confirmar en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'AVER' and modelo = 'VB342' and categoria = 'BARRA DE VIDEOCONFERENCIA'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'ETHERNET', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 1, 'Único cable. Red 10BaseT o 100BaseTX y alimentación PoE 802.3af por el mismo par. No necesita toma de corriente. Requiere switch PoE o inyector', 'csv'
from articulos a where coalesce(marca, '') = 'STEELCASE' and modelo = 'ROOMWIZARD II' and categoria = 'PANTALLA ROOMWIZARD'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HOST USB-C', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-C', 1, 'Cable de host desmontable de 1 m al portátil. Datos vídeo y hasta 100 W de carga con Power Delivery 3.0. Lleva adaptador de USB-C a USB-A', 'csv'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI', 2, 'salida'::sentido_puerto, 'hdmi'::senal, 'HDMI A', 2, 'HDMI 2.0 hasta 4096x2160 a 60 Hz. Solo dos pantallas simultáneas contando HDMI y DisplayPort', 'csv'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DISPLAYPORT', 2, 'salida'::sentido_puerto, 'otro'::senal, 'DisplayPort', 3, 'DisplayPort 1.2a. Solo dos pantallas simultáneas contando HDMI y DisplayPort', 'csv'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB-A', 4, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-A', 4, 'USB 3.2 Gen 1 a 5 Gb/s. Uno de ellos con carga rápida BC1.2', 'csv'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'USB-C', 1, 'bidireccional'::sentido_puerto, 'usb'::senal, 'USB-C', 5, 'USB 3.2 Gen 2 a 10 Gb/s y 7,5 W. Es puerto de datos aguas abajo. No confundir con el USB-C de host', 'csv'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RJ45', 1, 'bidireccional'::sentido_puerto, 'red'::senal, 'RJ45', 6, 'Gigabit Ethernet con Wake-on-LAN PXE y clonado de MAC', 'csv'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'AUDIO', 1, 'bidireccional'::sentido_puerto, 'audio_linea'::senal, 'Jack 3.5', 7, 'Combo de entrada y salida de audio de 3,5 mm', 'csv'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'DC IN', 1, 'entrada'::sentido_puerto, 'alimentacion'::senal, null, 8, 'Alimentador externo de 150 W cuya toma de red es IEC C5. El conector del alimentador al dock no está confirmado en ficha técnica', 'csv'
from articulos a where coalesce(marca, '') = 'TARGUS' and modelo = 'DOCK182' and categoria = 'DOCK STATION'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'RECEPTOR UNIFYING', 1, 'control'::sentido_puerto, 'usb'::senal, 'USB-A', 1, 'Nano receptor de 2,4 GHz que se enchufa en el PC no en el teclado. El teclado es inalámbrico y funciona con dos pilas AA. No lleva ninguna tirada de cable', 'csv'
from articulos a where coalesce(marca, '') = 'LOGITECH' and modelo = 'K400+' and categoria = 'TECLADO'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI', 1, 'bidireccional'::sentido_puerto, 'hdmi'::senal, 'HDMI A H', 1, 'Confirmado por Sergio: la caja lleva HDMI hembra-hembra. TopFrame es modular', 'csv'
from articulos a where coalesce(marca, '') = 'BACHMANN' and modelo = 'TOPFRAME' and categoria = 'CAJA DE CONEXIONES'
on conflict (articulo_id, nombre) do nothing;
insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
select a.id, 'HDMI', 1, 'bidireccional'::sentido_puerto, 'hdmi'::senal, 'HDMI A H', 1, 'Mismo criterio que la Bachmann segun Sergio. Sin confirmar modulo a modulo', 'csv'
from articulos a where coalesce(marca, '') = 'AMX' and modelo = 'HPX 1200' and categoria = 'CAJA DE CONEXIONES'
on conflict (articulo_id, nombre) do nothing;

-- Técnicos: 8 personas (data/tecnicos.csv)
-- El CSV manda sobre lo suyo. Lo escrito desde la app no se toca.
delete from tecnico_roles where tecnico_id in (select id from tecnicos where fuente = 'csv');
delete from tecnicos where fuente = 'csv';
insert into tecnicos (nombre, fuente) values ('Daniel', 'csv') on conflict (nombre) do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'inicio' from tecnicos where nombre = 'Daniel' and fuente = 'csv'
on conflict do nothing;
insert into tecnicos (nombre, fuente) values ('Elvin', 'csv') on conflict (nombre) do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'inicio' from tecnicos where nombre = 'Elvin' and fuente = 'csv'
on conflict do nothing;
insert into tecnicos (nombre, fuente) values ('Carlos', 'csv') on conflict (nombre) do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'inicio' from tecnicos where nombre = 'Carlos' and fuente = 'csv'
on conflict do nothing;
insert into tecnicos (nombre, fuente) values ('Diego', 'csv') on conflict (nombre) do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'inicio' from tecnicos where nombre = 'Diego' and fuente = 'csv'
on conflict do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'instalacion' from tecnicos where nombre = 'Diego' and fuente = 'csv'
on conflict do nothing;
insert into tecnicos (nombre, fuente) values ('Roberto', 'csv') on conflict (nombre) do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'recepcion' from tecnicos where nombre = 'Roberto' and fuente = 'csv'
on conflict do nothing;
insert into tecnicos (nombre, fuente) values ('Nacho', 'csv') on conflict (nombre) do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'recepcion' from tecnicos where nombre = 'Nacho' and fuente = 'csv'
on conflict do nothing;
insert into tecnicos (nombre, fuente) values ('Miguel', 'csv') on conflict (nombre) do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'recepcion' from tecnicos where nombre = 'Miguel' and fuente = 'csv'
on conflict do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'instalacion' from tecnicos where nombre = 'Miguel' and fuente = 'csv'
on conflict do nothing;
insert into tecnicos (nombre, fuente) values ('Marcos', 'csv') on conflict (nombre) do nothing;
insert into tecnico_roles (tecnico_id, rol)
select id, 'recepcion' from tecnicos where nombre = 'Marcos' and fuente = 'csv'
on conflict do nothing;

-- Plantillas de sala: 16 deducidas del inventario
insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('SALA TP · aforo 8', 'SALA TP', 8, 144, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QB65R-B', 1::numeric, false), ('VIDEOCONFERENCIA', 'CISCO SPARK ROOM KIT', 1::numeric, false), ('PANEL TÁCTIL', 'CISCO ROOM NAVIGATOR', 1::numeric, false), ('CAJA DE CONEXIONES', 'AMX', 1::numeric, false), ('MICRÓFONO', 'CISCO TABLE MICROPHONE MINI JACK (V1)', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'SALA TP · aforo 8'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('ULTRALIGERA QR · aforo 4', 'ULTRALIGERA QR', 4, 55, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QB55R-B', 1::numeric, false)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'ULTRALIGERA QR · aforo 4'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('SALA TP · aforo 4', 'SALA TP', 4, 32, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('VIDEOCONFERENCIA', 'CISCO SPARK ROOM KIT', 1::numeric, false), ('PANTALLA', 'SAMSUNG QB55R-B', 1::numeric, false), ('PANEL TÁCTIL', 'CISCO ROOM NAVIGATOR', 1::numeric, false), ('CAJA DE CONEXIONES', 'BACHMANN TOPFRAME', 1::numeric, true), ('MICRÓFONO', 'CISCO TABLE MICROPHONE MINI JACK (V1)', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'SALA TP · aforo 4'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('ULTRALIGERA QR · aforo 6', 'ULTRALIGERA QR', 6, 22, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QB65R-B', 1::numeric, false), ('PANTALLA ROOMWIZARD', 'STEELCASE ROOMWIZARD II', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'ULTRALIGERA QR · aforo 6'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('FIJA TP · aforo 10', 'FIJA TP', 10, 22, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QB65R-B', 2::numeric, false), ('MICRÓFONO', 'CISCO TABLE MICROPHONE MINI JACK (V1)', 1::numeric, false), ('VIDEOCONFERENCIA', 'CISCO WEBEX ROOM BAR PRO', 1::numeric, false), ('PANEL TÁCTIL', 'CISCO ROOM NAVIGATOR', 1::numeric, false), ('CAJA DE CONEXIONES', 'AMX', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'FIJA TP · aforo 10'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('TOTEM', 'TOTEM', null, 18, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG PM43H', 1::numeric, false), ('TÓTEM', 'VOGELS FD 2064 S TOTEM', 1::numeric, false), ('PANTALLA', 'SAMSUNG DM65E', 1::numeric, false), ('PC', 'LENOVO THINKCENTRE M920Q', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'TOTEM'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('LIGERA · aforo 3', 'LIGERA', 3, 15, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QM32R-B', 1::numeric, false), ('DOCK STATION', 'TARGUS DOCK182', 1::numeric, false), ('WEBCAM', 'JABRA PANACAST', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'LIGERA · aforo 3'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('ULTRALIGERA QR · aforo 8', 'ULTRALIGERA QR', 8, 15, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QB65R-B', 1::numeric, false), ('PANTALLA ROOMWIZARD', 'STEELCASE ROOMWIZARD II', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'ULTRALIGERA QR · aforo 8'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('LIGERA', 'LIGERA', null, 9, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SONY FW - 65X8570C', 2::numeric, false), ('DOCK STATION', 'TARGUS DOCK182', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'LIGERA'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('FIJA TP · aforo 14', 'FIJA TP', 14, 8, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QB65R-B', 2::numeric, false), ('MICRÓFONO', 'CISCO TABLE MICROPHONE MINI JACK (V1)', 2::numeric, false), ('VIDEOCONFERENCIA', 'CISCO WEBEX ROOM EQ QUADCAM', 1::numeric, false), ('CAJA DE CONEXIONES', 'AMX', 1::numeric, false), ('PANEL TÁCTIL', 'CISCO ROOM NAVIGATOR', 1::numeric, false), ('CÁMARA', 'CISCO QUAD CAMERA', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'FIJA TP · aforo 14'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('SALA TP · aforo 6', 'SALA TP', 6, 6, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QB65R-B', 1::numeric, false), ('VIDEOCONFERENCIA', 'CISCO SPARK ROOM KIT', 1::numeric, false), ('PANEL TÁCTIL', 'CISCO ROOM NAVIGATOR', 1::numeric, false), ('MICRÓFONO', 'CISCO TABLE MICROPHONE MINI JACK (V1)', 1::numeric, false), ('CAJA DE CONEXIONES', 'AMX', 1::numeric, true), ('MATRIZ', 'LIGHTWARE UCX-4X2-HC30', 1::numeric, true), ('DOCK STATION', 'TARGUS DOCK182', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'SALA TP · aforo 6'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('VIP · aforo 24', 'VIP', 24, 5, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('MICRÓFONO', 'BOSCH CONCENTRUS', 11::numeric, false), ('RECEPTOR VÍDEO', 'EXTRON DTP HDMI 4K 230 RX', 3::numeric, false), ('ALTAVOZ', 'BOSE FREESPACE DS100F', 3::numeric, false), ('MONITOR', 'ALBIRAL AH17TXHDGA', 3::numeric, false), ('TRANSMISOR VÍDEO', 'EXTRON DTP HDMI 4K 230 TX', 3::numeric, false), ('CÁMARA', 'SONY SRG-X400', 2::numeric, false), ('PANEL TÁCTIL', 'CISCO ROOM NAVIGATOR', 2::numeric, false), ('EXTENSOR', 'CRESTRON HD-TXU-4KZ-211-CHGR', 2::numeric, false), ('PANTALLA', 'SAMSUNG QB55C', 1::numeric, false), ('AMPLIFICADOR', 'BITTNER BASIC 400', 1::numeric, false), ('UNIDAD CONTROL MICROFONÍA', 'BOSCH DCN-CCU2', 1::numeric, false), ('PROYECTOR', 'EPSON EB-L630U', 1::numeric, false), ('PC', 'HP PRODESK 600 G4', 1::numeric, false), ('VIDEOCONFERENCIA', 'CISCO WEBEX ROOM EQ', 1::numeric, false), ('MATRIZ', 'EXTRON DTP CROSSPOINT 108', 1::numeric, true), ('PASARELA', 'CRESTRON HD-CTL-101', 1::numeric, true), ('CONTROLADORA', 'CRESTRON RMC4', 1::numeric, true), ('PROCESADOR DE AUDIO', 'BIAMP TESIRAFORTÉ CI', 1::numeric, true), ('CAJA DE CONEXIONES', 'BACHMANN TOPFRAME', 1::numeric, true), ('RECEPTOR MICRÓFONO', 'SHURE SLXD4D', 1::numeric, true), ('BASE CARGA MICRÓFONO', 'SHURE SBC203', 1::numeric, true), ('PANTALLA ROOMWIZARD', 'STEELCASE ROOMWIZARD II', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'VIP · aforo 24'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('SALA TP · aforo 12', 'SALA TP', 12, 5, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PANTALLA', 'SAMSUNG QB65R-B', 2::numeric, false), ('MICRÓFONO', 'CISCO TABLE MICROPHONE MINI JACK (V1)', 1::numeric, false), ('CAJA DE CONEXIONES', 'BACHMANN TOPFRAME', 1::numeric, false), ('VIDEOCONFERENCIA', 'CISCO WEBEX ROOM EQ', 1::numeric, false), ('PANEL TÁCTIL', 'CISCO ROOM NAVIGATOR', 1::numeric, false), ('PANTALLA ROOMWIZARD', 'STEELCASE ROOMWIZARD II', 1::numeric, true), ('CÁMARA', 'CISCO QUAD CAMERA', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'SALA TP · aforo 12'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('VIP · aforo 16', 'VIP', 16, 4, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('MONITOR', 'ARTHUR HOLM AH19DX216GA2M2P', 4::numeric, false), ('CAJA DE CONEXIONES', 'BACHMANN TOPFRAME', 3::numeric, false), ('ALTAVOZ', 'BOSE FREESPACE DS100F', 3::numeric, false), ('TRANSMISOR VÍDEO', 'EXTRON DTP HDMI 4K 230 TX', 2::numeric, false), ('CÁMARA', 'CISCO QUAD CAMERA', 2::numeric, false), ('MICRÓFONO', 'CISCO TABLE MICROPHONE MINI JACK (V2)', 2::numeric, false), ('PANEL TÁCTIL', 'CISCO ROOM NAVIGATOR', 2::numeric, false), ('EXTENSOR', 'CRESTRON HD-TXU-4KZ-211-CHGR', 2::numeric, false), ('VIDEOCONFERENCIA', 'CISCO WEBEX ROOM EQ', 1::numeric, false), ('UNIDAD CONTROL MICROFONÍA', 'BOSCH DCN-CCU2', 1::numeric, false), ('RECEPTOR VÍDEO', 'EXTRON DTP HDMI 4K 230 RX', 1::numeric, false), ('PASARELA', 'CRESTRON HD-CTL-101', 1::numeric, true), ('PANTALLA', 'SAMSUNG QB65B', 1::numeric, true), ('PC', 'HP PRODESK 600 G4', 1::numeric, true), ('CONTROLADORA', 'CRESTRON RMC4', 1::numeric, true), ('PROCESADOR DE AUDIO', 'BIAMP TESIRAFORTÉ CI', 1::numeric, true), ('PROYECTOR', 'SONY VPL-FHZ700L', 1::numeric, true), ('MATRIZ', 'EXTRON DTP CROSSPOINT 108', 1::numeric, true), ('RECEPTOR MICRÓFONO', 'SENNHEISER EM2050 558-626 MHZ', 1::numeric, true), ('DISTRIBUIDOR', 'CRESTRON HD-DA8-4KZ-E', 1::numeric, true), ('AMPLIFICADOR', 'BITTNER BASIC 400', 1::numeric, true), ('PANTALLA ROOMWIZARD', 'STEELCASE ROOMWIZARD II', 1::numeric, true), ('AMINO', 'TRIPLEPAY TPS-SPI-4', 1::numeric, true), ('MULTIVENTANA', 'CRESTRON HD-WP-4K-401-C', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'VIP · aforo 16'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('SALA TP · aforo 3', 'SALA TP', 3, 3, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('VIDEOCONFERENCIA', 'CISCO CS-DESK-K9', 1::numeric, false)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'SALA TP · aforo 3'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ('VIDEOWALL', 'VIDEOWALL', null, 3, 'Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.') on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;
insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
from plantillas_sala ps
cross join (values ('PC', 'HP ELITEDESK 800 G5', 1::numeric, false), ('PANTALLA', 'SAMSUNG DM82D', 1::numeric, false), ('EXPANSOR', 'AMX EXB-COM2', 1::numeric, true), ('CONTROLADORA', 'LG CVBA', 1::numeric, true)) as v(categoria, modelo_texto, cantidad, opcional)
where ps.nombre = 'VIDEOWALL'
  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);

-- Medidas de plantilla tomadas en sala: 1
update plantillas_sala set
  largo_m            = 4.7,
  ancho_m            = 2.5,
  alto_m             = 2.7,
  alto_falso_techo_m = 2.4,
  mesa_largo_m       = 2.4,
  mesa_ancho_m       = 1.21,
  mesa_alto_cm       = 73,
  notas              = 'Medida sobre la Sala de Bateria 006. Pantalla a 74 cm del suelo, caja de conexiones en mesa a 2,40 m de la pared de la pantalla, HDMI de 7 a 10 m y RJ45 de 10 m al panel Cisco.'
where nombre = 'SALA TP · aforo 8'
  -- Solo si nadie las ha rellenado ya desde la aplicación.
  and largo_m is null and ancho_m is null and mesa_largo_m is null;

-- Categorías de plantilla que el inventario escribía de otra forma
update plantilla_articulos set categoria = 'CAJA DE CONEXIONES'
where categoria = 'CAJA CONEXIONES';

-- Montaje de plantilla: dónde va cada equipo (5 líneas)
update plantilla_articulos pa set
  extremo = 'pantalla'::extremo_cable,
  x_m = 0, y_m = 1.25, z_m = 0.74
from plantillas_sala ps
where pa.plantilla_id = ps.id
  and ps.nombre = 'SALA TP · aforo 8'
  and pa.categoria = 'PANTALLA'
  and pa.x_m is null and pa.y_m is null;
update plantilla_articulos pa set
  extremo = 'pared'::extremo_cable,
  x_m = 0.05, y_m = 1.25, z_m = 0.55
from plantillas_sala ps
where pa.plantilla_id = ps.id
  and ps.nombre = 'SALA TP · aforo 8'
  and pa.categoria = 'VIDEOCONFERENCIA'
  and pa.x_m is null and pa.y_m is null;
update plantilla_articulos pa set
  extremo = 'caja_conexiones'::extremo_cable,
  x_m = 2.4, y_m = 1.25, z_m = 0.73
from plantillas_sala ps
where pa.plantilla_id = ps.id
  and ps.nombre = 'SALA TP · aforo 8'
  and pa.categoria = 'CAJA DE CONEXIONES'
  and pa.x_m is null and pa.y_m is null;
update plantilla_articulos pa set
  extremo = 'mesa'::extremo_cable,
  x_m = 2.1, y_m = 1.05, z_m = 0.73
from plantillas_sala ps
where pa.plantilla_id = ps.id
  and ps.nombre = 'SALA TP · aforo 8'
  and pa.categoria = 'PANEL TÁCTIL'
  and pa.x_m is null and pa.y_m is null;
update plantilla_articulos pa set
  extremo = 'mesa'::extremo_cable,
  x_m = 2.7, y_m = 1.05, z_m = 0.73
from plantillas_sala ps
where pa.plantilla_id = ps.id
  and ps.nombre = 'SALA TP · aforo 8'
  and pa.categoria = 'MICRÓFONO'
  and pa.x_m is null and pa.y_m is null;

-- Tiradas tipo de plantilla (4)
insert into plantilla_conexiones (plantilla_id, origen_linea_id, destino_linea_id, senal, ruta, orden, notas)
select ps.id, o.id, d.id, 'hdmi'::senal,
       'falso_techo'::ruta_cable, 1, 'El HDMI del portatil entra en el Spark. Es el unico que sube a la mesa.'
from plantillas_sala ps
join plantilla_articulos o on o.plantilla_id = ps.id and o.categoria = 'CAJA DE CONEXIONES'
join plantilla_articulos d on d.plantilla_id = ps.id and d.categoria = 'VIDEOCONFERENCIA'
where ps.nombre = 'SALA TP · aforo 8'
  and not exists (
    select 1 from plantilla_conexiones pc
    where pc.plantilla_id = ps.id
      and pc.origen_linea_id = o.id
      and pc.destino_linea_id = d.id
      and pc.senal = 'hdmi'::senal
  );
insert into plantilla_conexiones (plantilla_id, origen_linea_id, destino_linea_id, senal, ruta, orden, notas)
select ps.id, o.id, d.id, 'hdmi'::senal,
       'directo'::ruta_cable, 2, 'Salida del Spark a la pantalla. Los dos van en la misma pared.'
from plantillas_sala ps
join plantilla_articulos o on o.plantilla_id = ps.id and o.categoria = 'VIDEOCONFERENCIA'
join plantilla_articulos d on d.plantilla_id = ps.id and d.categoria = 'PANTALLA'
where ps.nombre = 'SALA TP · aforo 8'
  and not exists (
    select 1 from plantilla_conexiones pc
    where pc.plantilla_id = ps.id
      and pc.origen_linea_id = o.id
      and pc.destino_linea_id = d.id
      and pc.senal = 'hdmi'::senal
  );
insert into plantilla_conexiones (plantilla_id, origen_linea_id, destino_linea_id, senal, ruta, orden, notas)
select ps.id, o.id, d.id, 'red'::senal,
       'falso_techo'::ruta_cable, 3, 'RJ45 de 10 m. Ademas de datos, da corriente al panel por PoE.'
from plantillas_sala ps
join plantilla_articulos o on o.plantilla_id = ps.id and o.categoria = 'PANEL TÁCTIL'
join plantilla_articulos d on d.plantilla_id = ps.id and d.categoria = 'VIDEOCONFERENCIA'
where ps.nombre = 'SALA TP · aforo 8'
  and not exists (
    select 1 from plantilla_conexiones pc
    where pc.plantilla_id = ps.id
      and pc.origen_linea_id = o.id
      and pc.destino_linea_id = d.id
      and pc.senal = 'red'::senal
  );
insert into plantilla_conexiones (plantilla_id, origen_linea_id, destino_linea_id, senal, ruta, orden, notas)
select ps.id, o.id, d.id, 'red'::senal,
       'falso_techo'::ruta_cable, 4, 'RJ45 de la roseta de red del edificio para el portatil del usuario.'
from plantillas_sala ps
join plantilla_articulos o on o.plantilla_id = ps.id and o.categoria = 'CAJA DE CONEXIONES'
join plantilla_articulos d on d.plantilla_id = ps.id and d.categoria = 'VIDEOCONFERENCIA'
where ps.nombre = 'SALA TP · aforo 8'
  and not exists (
    select 1 from plantilla_conexiones pc
    where pc.plantilla_id = ps.id
      and pc.origen_linea_id = o.id
      and pc.destino_linea_id = d.id
      and pc.senal = 'red'::senal
  );

-- Enlaza cada línea de plantilla con el artículo del catálogo cuando el modelo coincide
update plantilla_articulos pa
set articulo_id = a.id
from articulos a
where pa.articulo_id is null
  and pa.modelo_texto is not null
  and upper(trim(coalesce(a.marca,'') || ' ' || a.modelo)) = upper(trim(pa.modelo_texto));

commit;
